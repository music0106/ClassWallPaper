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

// 사용자 영역 그리기 (로그인 버튼 / 사용자 이름 및 로그아웃 버튼)
function renderUserArea() {
  const userArea = document.getElementById("userArea");
  if (!userArea) return;
  userArea.innerHTML = "";

  if (currentUser) {
    const info = document.createElement("span");
    info.textContent = `${currentUser.displayName || "로그인 사용자"}님 `;
    userArea.appendChild(info);

    const logoutBtn = document.createElement("button");
    logoutBtn.textContent = "로그아웃";
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
// 백엔드 2: 여기에 "누가 썼는지"(uid)를 함께 저장하게 됩니다.
async function addMemo(text) {
  if (text.length < 5) return;

  const memoData = {
    text: text,
    createdAt: Date.now()
  };

  // 로그인한 사용자의 uid 및 이름을 함께 저장합니다.
  if (currentUser) {
    memoData.uid = currentUser.uid;
    memoData.author = currentUser.displayName || "익명";
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
// 백엔드 2: 지금은 누구든 남의 메모를 지울 수 있습니다. 이걸 막는 것이 과제입니다.
async function deleteMemo(id) {
  try {
    await deleteDoc(doc(db, "memos", id));
  } catch (error) {
    console.error("메모 삭제 중 오류 발생:", error);
    if (error.code === "permission-denied") {
      alert("본인이 작성한 메모만 삭제할 수 있습니다.");
    } else {
      alert("메모 삭제에 실패했습니다: " + error.message);
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

  // 삭제 버튼: 내가 쓴 메모이거나 작성자 정보(uid)가 없는 기존 메모인 경우에만 표시
  const canDelete = !memo.uid || (currentUser && memo.uid === currentUser.uid);

  if (canDelete) {
    const del = document.createElement("button");
    del.textContent = "×";
    del.addEventListener("click", async function () {
      await deleteMemo(memo.id);
      await render();
    });
    div.appendChild(del);
  }

  const span = document.createElement("span");
  span.textContent = memo.text;
  div.appendChild(span);

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
