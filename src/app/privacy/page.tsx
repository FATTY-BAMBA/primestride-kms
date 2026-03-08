import { Metadata } from "next";

export const metadata: Metadata = {
  title: "隱私權政策 Privacy Policy | Atlas EIP",
};

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#0a0e17", color: "#e8e6e1" }}>
      <nav style={{ height: 64, background: "rgba(10,14,23,0.9)", backdropFilter: "blur(24px)", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", position: "sticky", top: 0, zIndex: 100 }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "#e8e6e1" }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, #2563eb, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 700 }}>P</div>
          <span style={{ fontWeight: 700, fontSize: 17, fontFamily: "system-ui" }}>Atlas EIP</span>
        </a>
        <div style={{ display: "flex", gap: 10 }}>
          <a href="/login" style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", color: "#e8e6e1", textDecoration: "none", fontSize: 14, fontWeight: 600 }}>登入</a>
          <a href="/signup" style={{ padding: "8px 18px", borderRadius: 8, background: "#2563eb", color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 700 }}>免費註冊 →</a>
        </div>
      </nav>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "60px 24px 80px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>隱私權政策 Privacy Policy</h1>
        <p style={{ fontSize: 14, color: "#64748b", marginBottom: 40 }}>最後更新：2026 年 3 月 1 日 · Last updated: March 1, 2026</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 32, fontSize: 15, lineHeight: 1.8, color: "#94a3b8" }}>
          <section><h2 style={{ fontSize: 18, fontWeight: 700, color: "#e8e6e1", marginBottom: 8 }}>1. 資料蒐集 Data Collection</h2><p>我們蒐集以下資料以提供服務：帳戶資訊（姓名、電子郵件）、組織資訊（公司名稱、產業、規模）、上傳的文件內容、工作流程提交記錄（請假、加班、出差申請）。</p><p style={{ marginTop: 8 }}>We collect the following data to provide the Service: account information (name, email), organization information (company name, industry, size), uploaded document content, and workflow submissions (leave, overtime, business trip requests).</p></section>
          <section><h2 style={{ fontSize: 18, fontWeight: 700, color: "#e8e6e1", marginBottom: 8 }}>2. 資料使用 Data Usage</h2><p>您的資料僅用於：提供及改善本服務、執行 AI 合規分析、產生搜尋結果及文件回答。我們不會將您的資料用於訓練 AI 模型或出售給第三方。</p><p style={{ marginTop: 8 }}>Your data is used solely to: provide and improve the Service, perform AI compliance analysis, and generate search results and document answers. We do not use your data to train AI models or sell to third parties.</p></section>
          <section><h2 style={{ fontSize: 18, fontWeight: 700, color: "#e8e6e1", marginBottom: 8 }}>3. AI 處理 AI Processing</h2><p>本服務使用 OpenAI 的 API 處理文件分析和合規檢查。傳送至 AI 的資料僅包含與查詢相關的文件片段，且依據 OpenAI 的企業資料處理政策，不會被用於模型訓練。</p><p style={{ marginTop: 8 }}>The Service uses OpenAI APIs for document analysis and compliance checks. Data sent to AI includes only document fragments relevant to the query, and per OpenAI&apos;s enterprise data processing policy, is not used for model training.</p></section>
          <section><h2 style={{ fontSize: 18, fontWeight: 700, color: "#e8e6e1", marginBottom: 8 }}>4. 資料儲存 Data Storage</h2><p>您的資料儲存於 Supabase（PostgreSQL）資料庫中，位於安全的雲端環境。文件內容經過加密儲存。我們實施適當的技術和組織措施來保護您的資料安全。</p><p style={{ marginTop: 8 }}>Your data is stored in Supabase (PostgreSQL) databases in a secure cloud environment. Document content is encrypted at rest. We implement appropriate technical and organizational measures to protect your data security.</p></section>
          <section><h2 style={{ fontSize: 18, fontWeight: 700, color: "#e8e6e1", marginBottom: 8 }}>5. 資料保留 Data Retention</h2><p>您的資料在帳戶活躍期間保留。帳戶取消後，資料將保留 30 天以供匯出，之後永久刪除。合規檢查紀錄依法保留 5 年。</p><p style={{ marginTop: 8 }}>Your data is retained while the account is active. After account cancellation, data is retained for 30 days for export, then permanently deleted. Compliance check records are retained for 5 years as required by law.</p></section>
          <section><h2 style={{ fontSize: 18, fontWeight: 700, color: "#e8e6e1", marginBottom: 8 }}>6. 您的權利 Your Rights</h2><p>您有權：存取您的個人資料、要求更正不正確的資料、要求刪除您的資料、匯出您的資料、撤回同意。如需行使這些權利，請聯繫 hello@primestrideatlas.com。</p><p style={{ marginTop: 8 }}>You have the right to: access your personal data, request correction of inaccurate data, request deletion of your data, export your data, and withdraw consent. To exercise these rights, contact hello@primestrideatlas.com.</p></section>
          <section><h2 style={{ fontSize: 18, fontWeight: 700, color: "#e8e6e1", marginBottom: 8 }}>7. Cookie 政策 Cookie Policy</h2><p>本服務使用必要的 Cookie 來維持您的登入狀態和偏好設定。我們不使用追蹤型 Cookie 或第三方廣告 Cookie。</p><p style={{ marginTop: 8 }}>The Service uses essential cookies to maintain your login state and preferences. We do not use tracking cookies or third-party advertising cookies.</p></section>
          <section><h2 style={{ fontSize: 18, fontWeight: 700, color: "#e8e6e1", marginBottom: 8 }}>8. 聯絡方式 Contact</h2><p>如有任何隱私相關問題，請聯繫：hello@primestrideatlas.com</p><p>PrimeStride AI 智動科技有限公司</p><p>台北市中山區南京東路三段219號9樓</p></section>
        </div>
      </div>
      <footer style={{ padding: 24, borderTop: "1px solid rgba(255,255,255,0.07)", textAlign: "center" }}>
        <div style={{ display: "flex", gap: 20, justifyContent: "center", fontSize: 14, color: "#64748b" }}><a href="/terms" style={{ color: "#64748b", textDecoration: "none" }}>服務條款</a><a href="/privacy" style={{ color: "#94a3b8", textDecoration: "none" }}>隱私權政策</a><a href="/contact" style={{ color: "#64748b", textDecoration: "none" }}>聯繫我們</a></div>
        <div style={{ fontSize: 13, color: "#4b5563", marginTop: 8 }}>© 2026 Atlas EIP by PrimeStride AI</div>
      </footer>
    </div>
  );
}