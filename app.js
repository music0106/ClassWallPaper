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
  orderBy
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyAuTvxXy-yKs-qAamYI4J6gFrJKZn7BSpA",
  authDomain: "classwallpaper-292f9.firebaseapp.com",
  projectId: "classwallpaper-292f9",
  storageBucket: "classwallpaper-292f9.firebasestorage.app",
  messagingSenderId: "181071466036",
  appId: "1:181071466036:web:a5ca49a2307c8cf7c08461"
};

// Firebase 초기화 및 Firestore 인스턴스 가져오기
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


// ===================================================
// 데이터를 다루는 함수 세 개
// Firestore를 사용해 데이터를 읽고 쓰고 지웁니다.
// ===================================================

// 메모를 읽어 옵니다.
// 순서는 orderBy("createdAt") 으로 맞춥니다.
async function loadMemos() {
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
}

// 메모를 새로 씁니다.
// 백엔드 2: 여기에 "누가 썼는지"(uid)를 함께 저장하게 됩니다.
async function addMemo(text) {
  await addDoc(collection(db, "memos"), {
    text: text,
    createdAt: Date.now()
  });
}

// 메모를 지웁니다.
// 백엔드 2: 지금은 누구든 남의 메모를 지울 수 있습니다. 이걸 막는 것이 과제입니다.
async function deleteMemo(id) {
  await deleteDoc(doc(db, "memos", id));
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

  const del = document.createElement("button");
  del.textContent = "×";
  del.addEventListener("click", async function () {
    await deleteMemo(memo.id);
    await render();
  });
  div.appendChild(del);

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

input.addEventListener("keydown", async function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();

    const text = input.value.trim();
    if (text === "") return;

    await addMemo(text);
    input.value = "";
    await render();
  }
});


// 첫 화면 그리기
render();
input.focus();
