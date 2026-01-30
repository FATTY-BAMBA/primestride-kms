import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

// Create Supabase admin client (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  // Get the webhook secret from environment variables
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error('Missing CLERK_WEBHOOK_SECRET');
    return new Response('Missing webhook secret', { status: 500 });
  }

  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Missing svix headers', { status: 400 });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify the webhook
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Webhook verification failed:', err);
    return new Response('Webhook verification failed', { status: 400 });
  }

  // Handle the webhook event
  const eventType = evt.type;
  console.log(`📩 Webhook received: ${eventType}`);

  if (eventType === 'user.created') {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data;
    
    const email = email_addresses?.[0]?.email_address;
    const fullName = [first_name, last_name].filter(Boolean).join(' ') || email?.split('@')[0];

    console.log(`👤 Creating user: ${email} (${id})`);

    try {
      // 1. Create profile
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: id,
          email: email,
          full_name: fullName,
          avatar_url: image_url,
          role: 'user',
        }, {
          onConflict: 'id'
        });

      if (profileError) {
        console.error('❌ Profile creation error:', profileError);
      } else {
        console.log('✅ Profile created');
      }

      // 2. Create organization for new user
      const orgName = `${fullName}'s Workspace`;
      const orgSlug = `${email?.split('@')[0]?.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36)}`;

      const { data: org, error: orgError } = await supabaseAdmin
        .from('organizations')
        .insert({
          name: orgName,
          slug: orgSlug,
        })
        .select()
        .single();

      if (orgError) {
        console.error('❌ Organization creation error:', orgError);
      } else {
        console.log('✅ Organization created:', org.id);

        // 3. Add user as owner of the organization
        const { error: memberError } = await supabaseAdmin
          .from('organization_members')
          .insert({
            user_id: id,
            organization_id: org.id,
            role: 'owner',
          });

        if (memberError) {
          console.error('❌ Membership creation error:', memberError);
        } else {
          console.log('✅ User added as owner');
        }
      }

      return new Response('User created successfully', { status: 200 });

    } catch (error) {
      console.error('❌ Webhook processing error:', error);
      return new Response('Webhook processing failed', { status: 500 });
    }
  }

  if (eventType === 'user.updated') {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data;
    
    const email = email_addresses?.[0]?.email_address;
    const fullName = [first_name, last_name].filter(Boolean).join(' ');

    console.log(`📝 Updating user: ${email} (${id})`);

    try {
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({
          email: email,
          full_name: fullName || undefined,
          avatar_url: image_url,
        })
        .eq('id', id);

      if (error) {
        console.error('❌ Profile update error:', error);
      } else {
        console.log('✅ Profile updated');
      }

      return new Response('User updated successfully', { status: 200 });

    } catch (error) {
      console.error('❌ Webhook processing error:', error);
      return new Response('Webhook processing failed', { status: 500 });
    }
  }

  if (eventType === 'user.deleted') {
    const { id } = evt.data;

    console.log(`🗑️ Deleting user: ${id}`);

    try {
      // Delete profile (cascade should handle related data)
      const { error } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('❌ Profile deletion error:', error);
      } else {
        console.log('✅ Profile deleted');
      }

      return new Response('User deleted successfully', { status: 200 });

    } catch (error) {
      console.error('❌ Webhook processing error:', error);
      return new Response('Webhook processing failed', { status: 500 });
    }
  }

  return new Response('Webhook received', { status: 200 });
}