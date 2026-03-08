import { Metadata } from "next";

export const metadata: Metadata = {
  title: "服務條款 Terms of Service | Atlas EIP",
};

export default function TermsPage() {
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
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>服務條款 Terms of Service</h1>
        <p style={{ fontSize: 14, color: "#64748b", marginBottom: 40 }}>最後更新：2026 年 3 月 1 日 · Last updated: March 1, 2026</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 32, fontSize: 15, lineHeight: 1.8, color: "#94a3b8" }}>
          <section><h2 style={{ fontSize: 18, fontWeight: 700, color: "#e8e6e1", marginBottom: 8 }}>1. 服務說明 Service Description</h2><p>Atlas EIP（以下簡稱「本服務」）由 PrimeStride AI 智動科技有限公司（以下簡稱「本公司」）提供，是一個 AI 驅動的企業智慧平台，包含知識管理、合規工作流程自動化、以及員工自助服務功能。</p><p style={{ marginTop: 8 }}>Atlas EIP (&quot;the Service&quot;) is provided by PrimeStride AI Co., Ltd. (&quot;the Company&quot;), an AI-powered Enterprise Intelligence Platform offering knowledge management, compliance workflow automation, and employee self-service features.</p></section>
          <section><h2 style={{ fontSize: 18, fontWeight: 700, color: "#e8e6e1", marginBottom: 8 }}>2. 帳戶與組織 Accounts &amp; Organizations</h2><p>使用本服務需要建立帳戶並加入或建立組織。帳戶持有人須對其帳戶下的所有活動負責。組織管理員負責管理成員權限及資料存取。</p><p style={{ marginTop: 8 }}>Use of the Service requires creating an account and joining or creating an organization. Account holders are responsible for all activities under their accounts. Organization administrators are responsible for managing member permissions and data access.</p></section>
          <section><h2 style={{ fontSize: 18, fontWeight: 700, color: "#e8e6e1", marginBottom: 8 }}>3. 資料所有權 Data Ownership</h2><p>您上傳至本服務的所有文件、資料及內容仍屬於您的組織。本公司不會將您的資料出售或分享給第三方。您可以隨時匯出或刪除您的資料。</p><p style={{ marginTop: 8 }}>All documents, data, and content uploaded to the Service remain the property of your organization. The Company will not sell or share your data with third parties. You may export or delete your data at any time.</p></section>
          <section><h2 style={{ fontSize: 18, fontWeight: 700, color: "#e8e6e1", marginBottom: 8 }}>4. AI 合規功能免責聲明 AI Compliance Disclaimer</h2><p>本服務提供的 AI 合規檢查及勞基法分析僅供參考，不構成法律建議。儘管我們努力確保資訊的準確性，但本公司不保證合規分析結果的完整性或正確性。重大法律決策建議諮詢專業律師。</p><p style={{ marginTop: 8 }}>AI compliance checks and labor law analysis provided by the Service are for reference only and do not constitute legal advice. While we strive for accuracy, the Company does not guarantee the completeness or correctness of compliance analysis results. Consult a qualified attorney for significant legal decisions.</p></section>
          <section><h2 style={{ fontSize: 18, fontWeight: 700, color: "#e8e6e1", marginBottom: 8 }}>5. 方案與費用 Plans &amp; Fees</h2><p>本服務提供免費及付費方案。付費方案的費用將依照選定的方案週期收取。本公司保留調整價格的權利，但會提前 30 天通知現有客戶。</p><p style={{ marginTop: 8 }}>The Service offers free and paid plans. Paid plan fees are charged according to the selected billing cycle. The Company reserves the right to adjust pricing with 30 days advance notice to existing customers.</p></section>
          <section><h2 style={{ fontSize: 18, fontWeight: 700, color: "#e8e6e1", marginBottom: 8 }}>6. 服務終止 Termination</h2><p>您可以隨時取消帳戶。取消後，您的資料將保留 30 天以供匯出，之後將永久刪除。本公司保留因違反服務條款而終止帳戶的權利。</p><p style={{ marginTop: 8 }}>You may cancel your account at any time. After cancellation, your data will be retained for 30 days for export, after which it will be permanently deleted. The Company reserves the right to terminate accounts for violation of these Terms.</p></section>
          <section><h2 style={{ fontSize: 18, fontWeight: 700, color: "#e8e6e1", marginBottom: 8 }}>7. 管轄法律 Governing Law</h2><p>本服務條款受中華民國（台灣）法律管轄。任何爭議應以台北地方法院為第一審管轄法院。</p><p style={{ marginTop: 8 }}>These Terms are governed by the laws of the Republic of China (Taiwan). Any disputes shall be submitted to the Taipei District Court as the court of first instance.</p></section>
          <section><h2 style={{ fontSize: 18, fontWeight: 700, color: "#e8e6e1", marginBottom: 8 }}>8. 聯絡方式 Contact</h2><p>如有任何問題，請聯繫：hello@primestrideatlas.com</p><p>PrimeStride AI 智動科技有限公司</p><p>台北市中山區南京東路三段219號9樓</p></section>
        </div>
      </div>
      <footer style={{ padding: 24, borderTop: "1px solid rgba(255,255,255,0.07)", textAlign: "center" }}>
        <div style={{ display: "flex", gap: 20, justifyContent: "center", fontSize: 14, color: "#64748b" }}><a href="/terms" style={{ color: "#94a3b8", textDecoration: "none" }}>服務條款</a><a href="/privacy" style={{ color: "#64748b", textDecoration: "none" }}>隱私權政策</a><a href="/contact" style={{ color: "#64748b", textDecoration: "none" }}>聯繫我們</a></div>
        <div style={{ fontSize: 13, color: "#4b5563", marginTop: 8 }}>© 2026 Atlas EIP by PrimeStride AI</div>
      </footer>
    </div>
  );
}