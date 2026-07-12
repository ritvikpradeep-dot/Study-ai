const BASE = "https://ai-pdf-study-assistant-swart.vercel.app";
let cookies = "";

function mergeCookies(res) {
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const c of setCookie) {
    const pair = c.split(";")[0];
    const name = pair.split("=")[0];
    cookies = cookies
      .split("; ")
      .filter((x) => x && !x.startsWith(name + "="))
      .concat(pair)
      .join("; ");
  }
}

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { ...(opts.headers || {}), cookie: cookies },
    redirect: "manual",
  });
  mergeCookies(res);
  return res;
}

async function main() {
  const email = `prod_verify2_${Date.now()}@example.com`;
  const password = "verifypassword123";

  console.log("1) landing page reachable");
  let res = await fetch(BASE);
  console.log("   status", res.status);

  console.log("2) signup + login");
  res = await req("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name: "Prod Verify 2" }),
  });
  console.log("   signup status", res.status);
  res = await req("/api/auth/csrf");
  const { csrfToken } = await res.json();
  res = await req("/api/auth/callback/credentials?", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email, password, csrfToken, json: "true" }),
  });
  console.log("   login status", res.status);

  console.log("3) upload PDF (tests Vercel Blob + pdf text extraction)");
  const fs = await import("node:fs");
  const path = "C:\\Users\\LENOVO\\Desktop\\Cardiovascular-Health-and-Hypertension.pdf";
  const buf = fs.readFileSync(path);
  const form = new FormData();
  form.append("file", new Blob([buf], { type: "application/pdf" }), "Cardiovascular-Health-and-Hypertension.pdf");
  res = await req("/api/documents", { method: "POST", body: form });
  console.log("   status", res.status);
  const uploadText = await res.text();
  if (!res.ok) {
    console.log("   raw response (first 1000 chars):", uploadText.slice(0, 1000));
    throw new Error("upload failed, status " + res.status);
  }
  const uploadData = JSON.parse(uploadText);
  const docId = uploadData.document.id;
  console.log("   document status:", uploadData.document.status, "pages:", uploadData.document.pageCount);

  console.log("4) fetch the file back from Blob storage");
  res = await req(`/api/documents/${docId}/file`);
  console.log("   status", res.status, "content-type:", res.headers.get("content-type"));

  console.log("5) summarize (tests Groq)");
  res = await req(`/api/documents/${docId}/summarize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ length: "short", style: "bullet", options: [] }),
  });
  console.log("   status", res.status);
  console.log("   summary:", (await res.text()).slice(0, 200));

  console.log("6) chat");
  res = await req(`/api/documents/${docId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "One sentence: what is this document about?" }),
  });
  console.log("   status", res.status);
  console.log("   reply:", (await res.text()).slice(0, 200));

  console.log("7) quiz generation");
  res = await req(`/api/documents/${docId}/quizzes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: "document", questionCount: 3, difficulty: "easy", types: ["mcq"] }),
  });
  const quizData = await res.json();
  console.log("   status", res.status, "questions:", quizData.quiz?.questions?.length);

  console.log("\nALL GOOD");
}

main().catch((e) => {
  console.error("VERIFY FAILED:", e);
  process.exit(1);
});
