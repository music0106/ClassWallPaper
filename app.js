// ===================================================
// 우리 반 담벼락 - Firebase Firestore 연동
// ===================================================

// Firebase SDK 불러오기 (CDN ES Module 방식)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
  query,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyAuTvxXy-yKs-qAamYI4J6gFrJKZn7BSpA",
  authDomain: "classwallpaper-292f9.firebaseapp.com",
  projectId: "classwallpaper-292f9",
  storageBucket: "classwallpaper-292f9.firebasestorage.app",
  messagingSenderId: "181071466036",
  appId: "1:181071466036:web:a5ca49a2307c8cf7c08461"
};

// Firebase 초기화 및 Firestore / Auth 인스턴스 가져오기
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// 현재 로그인한 사용자 정보
let currentUser = null;


// ===================================================
// 교사 UID 목록 및 역할(Role) 판별
// ===================================================

// 연수 실습: 여기에 교사(teacher)로 지정할 UID를 등록할 수 있습니다.
export const TEACHER_UIDS = [
  "xfq1agGlssSdIyyOr5FeRJWBd6T2" // 선생님(교사)의 실제 UID
];

// 현재 사용자의 역할을 반환합니다 ("teacher" 또는 "student")
function getUserRole(user) {
  if (!user) return null;
  // 1. 실습/테스트용 수동 전환 모드가 설정되어 있으면 그 값 우선 (토글 버튼 테스트용)
  const savedRole = localStorage.getItem("wall_user_role");
  if (savedRole === "teacher" || savedRole === "student") {
    return savedRole;
  }
  // 2. 등록된 교사 UID 목록에 있는 경우 기본 교사
  if (TEACHER_UIDS.includes(user.uid)) return "teacher";
  // 3. 기본값은 학생
  return "student";
}


// ===================================================
// 로그인 / 로그아웃 및 사용자 관리
// ===================================================

// 구글 로그인
async function login() {
  try {
    const result = await signInWithPopup(auth, provider);
    currentUser = result.user;
    renderUserArea();
    await render();
  } catch (error) {
    console.error("로그인 실패:", error);
    alert("구글 로그인에 실패했습니다: " + error.message);
  }
}

// 로그아웃
async function logout() {
  try {
    await signOut(auth);
    currentUser = null;
    renderUserArea();
    await render();
  } catch (error) {
    console.error("로그아웃 실패:", error);
  }
}

// 사용자 영역 그리기 (로그인 버튼 / 사용자 정보, 역할 및 로그아웃 버튼)
function renderUserArea() {
  const userArea = document.getElementById("userArea");
  if (!userArea) return;
  userArea.innerHTML = "";

  if (currentUser) {
    const role = getUserRole(currentUser);
    const roleKorean = role === "teacher" ? "선생님 (teacher)" : "학생 (student)";
    const badgeClass = role === "teacher" ? "badge teacher" : "badge student";

    // 콘솔에 UID 출력 (개발자 도구에서 확인 가능)
    console.log(`[사용자 정보] 이름: ${currentUser.displayName}, 역할: ${role}, UID: ${currentUser.uid}`);

    // 1. 사용자 이름 및 역할 배지
    const infoSpan = document.createElement("span");
    infoSpan.innerHTML = `<strong>${currentUser.displayName || "로그인 사용자"}</strong>님 <span class="${badgeClass}">${roleKorean}</span>`;
    userArea.appendChild(infoSpan);

    // 2. 필요할 때만 UID를 복사할 수 있는 작은 버튼
    const copyUidBtn = document.createElement("button");
    copyUidBtn.textContent = "UID 복사";
    copyUidBtn.style.marginLeft = "8px";
    copyUidBtn.style.fontSize = "12px";
    copyUidBtn.title = "내 UID 복사하기";
    copyUidBtn.onclick = function () {
      navigator.clipboard.writeText(currentUser.uid);
      alert(`내 UID가 복사되었습니다!\n${currentUser.uid}`);
    };
    userArea.appendChild(copyUidBtn);

    // 3. 실습용 역할 전환(교사 <-> 학생) 토글 버튼
    const toggleRoleBtn = document.createElement("button");
    toggleRoleBtn.textContent = role === "teacher" ? "👩‍🎓 학생 모드로 전환" : "👨‍🏫 교사 모드로 전환";
    toggleRoleBtn.style.marginLeft = "8px";
    toggleRoleBtn.style.fontSize = "12px";
    toggleRoleBtn.onclick = function () {
      const nextRole = role === "teacher" ? "student" : "teacher";
      localStorage.setItem("wall_user_role", nextRole);
      renderUserArea();
      render();
    };
    userArea.appendChild(toggleRoleBtn);

    // 4. 로그아웃 버튼
    const logoutBtn = document.createElement("button");
    logoutBtn.textContent = "로그아웃";
    logoutBtn.style.marginLeft = "8px";
    logoutBtn.style.fontSize = "12px";
    logoutBtn.addEventListener("click", logout);
    userArea.appendChild(logoutBtn);
  } else {
    const loginBtn = document.createElement("button");
    loginBtn.textContent = "구글로 로그인";
    loginBtn.addEventListener("click", login);
    userArea.appendChild(loginBtn);
  }
}

// 로그인 상태 변경 감지
onAuthStateChanged(auth, function (user) {
  currentUser = user;
  renderUserArea();
  render();
});


// ===================================================
// 데이터를 다루는 함수 세 개
// Firestore를 사용해 데이터를 읽고 쓰고 지웁니다.
// ===================================================

// 메모를 읽어 옵니다.
// 순서는 orderBy("createdAt") 으로 맞춥니다.
async function loadMemos() {
  try {
    const q = query(collection(db, "memos"), orderBy("createdAt"));
    const querySnapshot = await getDocs(q);
    const memoList = [];
    querySnapshot.forEach(function (docSnap) {
      memoList.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });
    return memoList;
  } catch (error) {
    console.error("메모 불러오기 실패:", error);
    // orderBy 오류 시 폴백: 정렬 없이 가져와 클라이언트에서 정렬
    try {
      const fallbackSnapshot = await getDocs(collection(db, "memos"));
      const fallbackList = [];
      fallbackSnapshot.forEach(function (docSnap) {
        fallbackList.push({
          id: docSnap.id,
          ...docSnap.data()
        });
      });
      return fallbackList.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    } catch (fallbackError) {
      console.error("폴백 읽기 실패:", fallbackError);
      return [];
    }
  }
}

// 메모를 새로 씁니다.
// 5글자 이상일 때만 저장합니다.
// 백엔드 2: 여기에 "누가 썼는지"(uid)와 역할(role)을 함께 저장하게 됩니다.
async function addMemo(text) {
  if (text.length < 5) return;

  const role = getUserRole(currentUser) || "student";

  const memoData = {
    text: text,
    createdAt: Date.now()
  };

  // 로그인한 사용자의 uid, 이름, 역할을 함께 저장합니다.
  if (currentUser) {
    memoData.uid = currentUser.uid;
    memoData.author = currentUser.displayName || "익명";
    memoData.role = role;
  }

  try {
    await addDoc(collection(db, "memos"), memoData);
  } catch (error) {
    console.error("메모 저장 중 오류 발생:", error);
    if (error.code === "permission-denied") {
      alert("메모 저장 실패: Firestore 보안 규칙에 의해 쓰기 권한이 거부되었습니다.\nFirebase 콘솔의 Firestore > 규칙(Rules) 탭 설정을 확인해 주세요.");
    } else {
      alert("메모 저장 중 오류가 발생했습니다: " + error.message);
    }
    throw error;
  }
}

// 메모를 지웁니다.
// 오직 교사(선생님)만 삭제할 수 있습니다.
async function deleteMemo(id) {
  const role = getUserRole(currentUser);
  if (role !== "teacher") {
    alert("삭제 권한이 없습니다. 교사(선생님)만 메모를 삭제할 수 있습니다.");
    return;
  }

  try {
    await deleteDoc(doc(db, "memos", id));
  } catch (error) {
    console.error("메모 삭제 중 오류 발생:", error);
    if (error.code === "permission-denied") {
      alert("삭제 실패: Firestore 보안 규칙에 의해 삭제 권한이 거부되었습니다.");
    } else {
      alert("메모 삭제에 실패했습니다: " + error.message);
    }
  }
}


// ===================================================
// AI 코멘트 생성 및 저장
// 교사가 버튼을 누르면 무료 Gemini API(gemini-1.5-flash)가
// 학생의 글에 긍정적인 응원과 피드백 코멘트를 작성합니다.
// ===================================================

// 로컬 환경(Live Server 등)에서 /api/gemini 서버리스가 없을 때 브라우저에서 직접 테스트할 수 있는 폴백 함수
async function callGeminiDirectlyForLocal(memoText) {
  let apiKey = localStorage.getItem("local_gemini_api_key");
  if (!apiKey) {
    apiKey = prompt(
      "로컬 환경(Live Server)에서 Gemini API를 테스트하기 위해 Google AI Studio API 키를 입력해 주세요.\n(한 번 입력하면 브라우저에 저장됩니다. Vercel 배포 시에는 서버 환경변수를 자동으로 사용합니다)"
    );
    if (!apiKey) throw new Error("Gemini API 키가 입력되지 않았습니다.");
    localStorage.setItem("local_gemini_api_key", apiKey.trim());
  }

  const MODEL_NAME = "gemini-1.5-flash";
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey.trim()}`;

  // 개인정보 보호(AGENTS.md): uid나 이메일 등 식별 정보를 제외하고 순수 텍스트만 전달
  const systemPrompt = "당신은 따뜻하고 학생을 깊이 격려해 주는 친절한 학교 선생님입니다. 학생이 작성한 담벼락 메모를 읽고, 긍정적인 피드백과 칭찬을 담아 다정한 어조로 1~2문장의 짧은 코멘트를 남겨주세요.";
  const userPrompt = `학생이 쓴 글: "${memoText}"\n\n위 내용에 대해 다정하고 친절한 어조로 1~2문장의 짧은 응원/칭찬 코멘트를 작성해 주세요.`;

  const response = await fetch(geminiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 150 }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 400 || response.status === 403) {
      localStorage.removeItem("local_gemini_api_key"); // 키 오류 시 재입력 유도
    }
    throw new Error(`Gemini API 호출 실패 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "참 좋은 생각을 적어주었네요! 힘내요! 👍";
}

// AI 코멘트를 요청하고 Firestore에 저장하는 함수
async function generateAIComment(memoId, memoText, btnElement) {
  const role = getUserRole(currentUser);
  if (role !== "teacher") {
    alert("AI 코멘트 작성 권한이 없습니다. 교사(선생님)만 이용할 수 있습니다.");
    return;
  }

  const originalText = btnElement ? btnElement.textContent : "";
  if (btnElement) {
    btnElement.disabled = true;
    btnElement.textContent = "🤖 AI 생각 중...";
  }

  try {
    let comment = "";

    // 1. 먼저 Vercel 서버리스 함수(/api/gemini) 호출 시도
    let useServerless = true;
    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: memoText })
      });

      if (res.ok) {
        const data = await res.json();
        comment = data.comment;
      } else if (res.status === 404) {
        // 로컬 Live Server 환경에서는 /api/gemini 경로를 찾지 못함
        useServerless = false;
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `서버 오류 (${res.status})`);
      }
    } catch (fetchErr) {
      useServerless = false;
    }

    // 2. Vercel 서버리스 함수를 쓸 수 없는 로컬 환경(Live Server)인 경우 직접 호출 폴백
    if (!useServerless) {
      comment = await callGeminiDirectlyForLocal(memoText);
    }

    if (!comment) {
      throw new Error("코멘트 내용을 가져오지 못했습니다.");
    }

    // 3. Firestore 메모 문서에 AI 코멘트 업데이트 (교사 권한 필요)
    await updateDoc(doc(db, "memos", memoId), {
      aiComment: comment,
      aiCommentAt: Date.now()
    });

    await render();
  } catch (error) {
    console.error("AI 코멘트 생성 오류:", error);
    if (error.code === "permission-denied") {
      alert("Firestore 보안 규칙에 의해 코멘트 저장이 거부되었습니다.\nFirestore 규칙에 'allow update'가 교사에게 허용되어 있는지 확인해 주세요.");
    } else {
      alert("AI 코멘트 생성 중 오류가 발생했습니다:\n" + error.message);
    }
  } finally {
    if (btnElement) {
      btnElement.disabled = false;
      btnElement.textContent = originalText;
    }
  }
}


// ===================================================
// 화면 그리기
// ===================================================

async function render() {
  const wall = document.getElementById("wall");
  wall.innerHTML = "";

  const memoList = await loadMemos();
  memoList.forEach(function (memo) {
    wall.appendChild(makeMemo(memo));
  });
}

// 메모 한 장 만들기
function makeMemo(memo) {
  const div = document.createElement("div");
  div.className = "memo";

  const role = getUserRole(currentUser);
  const isTeacher = role === "teacher";

  // 삭제 권한: 오직 교사(teacher)에게만 삭제 버튼(×)이 표시됩니다.
  // 학생 모드일 때는 삭제 버튼이 아예 나타나지 않습니다.
  if (isTeacher) {
    const del = document.createElement("button");
    del.className = "del-btn";
    del.textContent = "×";
    del.title = "선생님 권한으로 삭제";
    del.style.color = "#d32f2f";
    del.addEventListener("click", async function () {
      if (confirm("선생님 권한으로 이 메모를 삭제하시겠습니까?")) {
        await deleteMemo(memo.id);
        await render();
      }
    });
    div.appendChild(del);
  }

  // 메모 본문
  const span = document.createElement("span");
  span.textContent = memo.text;
  div.appendChild(span);

  // 작성자 정보 및 역할 라벨 표시
  if (memo.author) {
    const authorSpan = document.createElement("small");
    authorSpan.style.display = "block";
    authorSpan.style.color = "#777";
    authorSpan.style.marginTop = "6px";
    const authorRoleTag = memo.role === "teacher" ? " [선생님]" : "";
    authorSpan.textContent = `작성: ${memo.author}${authorRoleTag}`;
    div.appendChild(authorSpan);
  }

  // AI 코멘트가 있는 경우 카드 내부에 표시
  if (memo.aiComment) {
    const aiBox = document.createElement("div");
    aiBox.className = "ai-comment-box";
    aiBox.innerHTML = `
      <div class="ai-comment-header">🤖 선생님 AI 코멘트</div>
      <div class="ai-comment-body">${memo.aiComment}</div>
    `;
    div.appendChild(aiBox);
  }

  // 교사(teacher) 권한일 때만 AI 코멘트 생성/재생성 버튼 표시
  if (isTeacher) {
    const aiBtn = document.createElement("button");
    aiBtn.className = "ai-comment-btn";
    aiBtn.textContent = memo.aiComment ? "🤖 AI 코멘트 다시 달기" : "🤖 AI 코멘트 달기";
    aiBtn.title = "Gemini 1.5 Flash AI가 학생 글에 따뜻한 응원 피드백을 남깁니다";
    aiBtn.addEventListener("click", async function (e) {
      e.stopPropagation();
      await generateAIComment(memo.id, memo.text, aiBtn);
    });
    div.appendChild(aiBtn);
  }

  return div;
}


// ===================================================
// 메모 쓰는 칸
// 엔터를 누르면 담벼락에 붙습니다 (줄바꿈은 Shift + 엔터)
// ===================================================

const input = document.getElementById("input");
const addBtn = document.getElementById("addBtn");

// 메모 제출 공통 함수
async function submitMemo() {
  const text = input.value.trim();
  if (text === "") return;

  // 로그인 확인
  if (!currentUser) {
    alert("로그인 후 메모를 작성할 수 있습니다.");
    return;
  }

  // 5글자 미만인 경우 알림을 띄우고 중단
  if (text.length < 5) {
    alert("메모는 5글자 이상 입력해 주세요.");
    return;
  }

  try {
    await addMemo(text);
    input.value = "";
    await render();
  } catch (err) {
    // addMemo 내에서 사용자 알림 처리
  }
}

input.addEventListener("keydown", async function (e) {
  // 한글 입력 중(IME 조합 중) 엔터 중복 실행 방지
  if (e.isComposing) return;

  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    await submitMemo();
  }
});

if (addBtn) {
  addBtn.addEventListener("click", async function () {
    await submitMemo();
  });
}

// Firestore 실시간 동기화 리스너 (담벼락 실시간 반영)
try {
  const realtimeQuery = query(collection(db, "memos"), orderBy("createdAt"));
  onSnapshot(realtimeQuery, function () {
    render();
  }, function (err) {
    console.warn("실시간 동기화 대기 중:", err);
  });
} catch (e) {
  console.warn("onSnapshot 연결 건너뜀:", e);
}


// 첫 화면 그리기
render();
input.focus();
