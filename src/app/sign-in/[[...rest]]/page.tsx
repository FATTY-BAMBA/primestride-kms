import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #F8F7FF 0%, #F3E8FF 100%)",
      }}
    >
      <SignIn 
        appearance={{
          elements: {
            rootBox: {
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
              borderRadius: "16px",
            },
            card: {
              borderRadius: "16px",
            },
            headerTitle: {
              fontSize: "24px",
              fontWeight: "700",
            },
            primaryButton: {
              background: "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)",
              borderRadius: "10px",
            },
          },
        }}
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/library"
      />
    </main>
  );
}