"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface Organization {
  id: string;
  name: string;
  role: string;
  document_count: number;
  member_count: number;
}

export default function OrgSwitcher() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchOrganizations = async () => {
    try {
      const res = await fetch("/api/organizations");
      const data = await res.json();
      
      if (res.ok && data.organizations) {
        setOrganizations(data.organizations);
        
        // Set current org from localStorage or first org with docs
        const savedOrgId = localStorage.getItem("activeOrgId");
        const savedOrg = data.organizations.find((o: Organization) => o.id === savedOrgId);
        
        if (savedOrg) {
          setCurrentOrg(savedOrg);
        } else {
          // Default to org with most documents
          const sorted = [...data.organizations].sort((a, b) => b.document_count - a.document_count);
          setCurrentOrg(sorted[0] || null);
          if (sorted[0]) {
            localStorage.setItem("activeOrgId", sorted[0].id);
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch organizations:", error);
    } finally {
      setLoading(false);
    }
  };

  const switchOrganization = async (org: Organization) => {
    try {
      // Save to localStorage
      localStorage.setItem("activeOrgId", org.id);
      setCurrentOrg(org);
      setIsOpen(false);

      // Notify server (optional - for persistence)
      await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: org.id }),
      });

      // Refresh the page to load new org's data
      router.refresh();
      window.location.reload();
    } catch (error) {
      console.error("Failed to switch organization:", error);
    }
  };

  // Don't show if user has only one org
  if (loading) {
    return (
      <div style={{
        padding: "8px 12px",
        background: "rgba(124, 58, 237, 0.1)",
        borderRadius: 8,
        fontSize: 13,
        color: "#6B7280",
      }}>
        Loading...
      </div>
    );
  }

  if (organizations.length <= 1) {
    // Show current org name without dropdown
    return currentOrg ? (
      <div style={{
        padding: "8px 14px",
        background: "rgba(124, 58, 237, 0.1)",
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 600,
        color: "#7C3AED",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}>
        <span>🏢</span>
        <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {currentOrg.name}
        </span>
      </div>
    ) : null;
  }

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: "8px 14px",
          background: isOpen ? "rgba(124, 58, 237, 0.15)" : "rgba(124, 58, 237, 0.1)",
          border: "1px solid transparent",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          color: "#7C3AED",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
          transition: "all 0.2s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(124, 58, 237, 0.15)";
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.background = "rgba(124, 58, 237, 0.1)";
          }
        }}
      >
        <span>🏢</span>
        <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {currentOrg?.name || "Select Org"}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            minWidth: 280,
            background: "white",
            borderRadius: 12,
            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.15)",
            border: "1px solid #E5E7EB",
            zIndex: 1000,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div style={{
            padding: "12px 16px",
            borderBottom: "1px solid #F3F4F6",
            fontSize: 12,
            fontWeight: 600,
            color: "#9CA3AF",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}>
            Switch Organization
          </div>

          {/* Org List */}
          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            {organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => switchOrganization(org)}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  background: currentOrg?.id === org.id ? "#F5F3FF" : "white",
                  border: "none",
                  borderBottom: "1px solid #F3F4F6",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (currentOrg?.id !== org.id) {
                    e.currentTarget.style.background = "#FAFAFA";
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentOrg?.id !== org.id) {
                    e.currentTarget.style.background = "white";
                  }
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontWeight: 600,
                      fontSize: 14,
                      color: "#111827",
                      marginBottom: 4,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}>
                      {org.name}
                      {currentOrg?.id === org.id && (
                        <span style={{
                          background: "#7C3AED",
                          color: "white",
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 700,
                        }}>
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: 12,
                      color: "#6B7280",
                      display: "flex",
                      gap: 12,
                    }}>
                      <span>📄 {org.document_count} docs</span>
                      <span>👥 {org.member_count} members</span>
                    </div>
                  </div>
                  <div style={{
                    padding: "4px 8px",
                    background: org.role === "owner" ? "#FEF3C7" : org.role === "admin" ? "#DBEAFE" : "#F3F4F6",
                    color: org.role === "owner" ? "#92400E" : org.role === "admin" ? "#1D4ED8" : "#4B5563",
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "capitalize",
                  }}>
                    {org.role}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Footer */}
          <div style={{
            padding: "12px 16px",
            borderTop: "1px solid #F3F4F6",
            background: "#FAFAFA",
          }}>
            <button
              onClick={() => {
                setIsOpen(false);
                // Could link to create org page
              }}
              style={{
                width: "100%",
                padding: "10px",
                background: "white",
                border: "1px dashed #D1D5DB",
                borderRadius: 8,
                fontSize: 13,
                color: "#6B7280",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#7C3AED";
                e.currentTarget.style.color = "#7C3AED";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#D1D5DB";
                e.currentTarget.style.color = "#6B7280";
              }}
            >
              <span>➕</span>
              <span>Create New Organization</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}