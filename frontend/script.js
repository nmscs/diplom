const API = 'https://diplom-r1b8.onrender.com';

let currentUser = null;

const token = localStorage.getItem("token");
const backendUserRaw = localStorage.getItem("user");

if (token && backendUserRaw) {
    try {
        const u = JSON.parse(backendUserRaw);
        currentUser = u.username;
    } catch {
        currentUser = null;
    }
} else {
    currentUser = null;
}




/* ЭЛЕМЕНТЫ УПРАВЛЕНИЯ ПОЛЬЗОВАТЕЛЬСКИМ ИНТЕРФЕЙСОМ  */

const profileBtn = document.getElementById("profileBtn");
const signoutSidebar = document.getElementById("signoutSidebar");

function updateProfileButton() {
    if (profileBtn) {
        profileBtn.textContent = currentUser ? `profile @${currentUser}` : "sign in";
    }
}

function fixProfileLinks() {
    const links = document.querySelectorAll('a[href^="profile.html"]');
    links.forEach(a => {
        if (currentUser) {
            a.href = `profile.html?user=${encodeURIComponent(currentUser)}`;
        } else {
            a.href = "profile.html"; 
        }
    });
}

document.addEventListener("DOMContentLoaded", fixProfileLinks);


function updateSignoutVisibility() {
    if (signoutSidebar) {
        currentUser
            ? signoutSidebar.classList.remove("hidden")
            : signoutSidebar.classList.add("hidden");
    }
}

updateProfileButton();
updateSignoutVisibility();

const navProfile = document.getElementById("navProfile");

navProfile?.addEventListener("click", (e) => {
    e.preventDefault();

    // если НЕ залогинен — кидаем на главную с флагом
    if (!currentUser) {
        window.location.href = "index.html?auth=signin";
        return;
    }

    // если залогинен — открываем СВОЙ профиль
    window.location.href = `profile.html?user=${currentUser}`;
});


/* СПОСОБЫ АУТЕНТИФИКАЦИИ */

const signinModal = document.getElementById("signinModal");
const registerModal = document.getElementById("registerModal");

const openRegister = document.getElementById("openRegister");
const openSignin = document.getElementById("openSignin");

const signinUsername = document.getElementById("signinUsername");
const signinPassword = document.getElementById("signinPassword");
const signinSubmit = document.getElementById("signinSubmit");

const regName = document.getElementById("regName");
const regUsername = document.getElementById("regUsername");
const regPassword = document.getElementById("regPassword");


// открыть вход или профиль
profileBtn?.addEventListener("click", () => {
    if (!currentUser) {
        signinModal?.classList.remove("hidden");
    } else {
        window.location.href = `profile.html?user=${currentUser}`;
    }
});

// переключение модалок
openRegister?.addEventListener("click", () => {
    signinModal?.classList.add("hidden");
    registerModal?.classList.remove("hidden");
});

openSignin?.addEventListener("click", () => {
    registerModal?.classList.add("hidden");
    signinModal?.classList.remove("hidden");
});


/* ЗАКРЫТИЕ МОДАЛКИ НА КРЕСТИК */

document.querySelectorAll(".modal-close").forEach(closeBtn => {
    closeBtn.addEventListener("click", () => {
        const modal = closeBtn.closest(".modal");
        modal?.classList.add("hidden");
    });
});


/* ЗАКРЫТИЕ МОДАЛКИ КЛИКОМ ВНЕ */
document.querySelectorAll(".modal").forEach(modal => {
    modal.addEventListener("click", e => {
        if (e.target === modal) modal.classList.add("hidden");
    });
});


/* ЗАКРЫТИЕ МОДАЛКИ НА ESC*/

document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
        document.querySelectorAll(".modal").forEach(m => m.classList.add("hidden"));
    }
});


/* ОШИБКИ */

function showError(el, msg) {
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
}

function hideError(el) {
    if (!el) return;
    el.textContent = "";
    el.classList.remove("show");
}

function shake(input) {
    if (!input) return;
    input.classList.remove("shake");
    void input.offsetWidth;   // перезапуск анимации
    input.classList.add("shake");

    setTimeout(() => {
        input.classList.remove("shake");
    }, 400);
}


/*  ВХОД */

signinSubmit?.addEventListener("click", handleSignIn);

signinPassword?.addEventListener("keydown", e => {
    if (e.key === "Enter") handleSignIn();
});

function handleSignIn() {
    const username = signinUsername.value.trim().toLowerCase();
    const password = signinPassword.value;

    const errorUser = document.getElementById("signinUserError");
    const errorPass = document.getElementById("signinPassError");

    // Чистим ошибки
    hideError(errorUser);
    hideError(errorPass);

    // Чистим подсветку
    signinUsername.classList.remove("input-error");
    signinPassword.classList.remove("input-error");

    fetch("https://diplom-r1b8.onrender.com/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            showError(errorUser, data.error);
            signinUsername.classList.add("input-error");
            signinPassword.classList.add("input-error");
            shake(signinUsername);
            shake(signinPassword);
            return;
        }

        
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));

        
        currentUser = data.user.username;

        signinModal?.classList.add("hidden");
        updateProfileButton();
        updateSignoutVisibility();

    });


    
}


/* РЕГИСТРАЦИЯ */

document.getElementById("registerSubmit")?.addEventListener("click", handleSignUp);

regPassword?.addEventListener("keydown", e => {
    if (e.key === "Enter") handleSignUp();
});

function handleSignUp() {
    const name = regName.value.trim();
    const username = regUsername.value.trim().toLowerCase();
    const password = regPassword.value;

    const nameErr = document.getElementById("regNameError");
    const userErr = document.getElementById("regUserError");
    const passErr = document.getElementById("regPassError");

    // очищаем тексты ошибок
    hideError(nameErr);
    hideError(userErr);
    hideError(passErr);

    // очищаем подсветку полей
    regName.classList.remove("input-error");
    regUsername.classList.remove("input-error");
    regPassword.classList.remove("input-error");

    // Проверка имени 
    if (name.length < 2) {
        showError(nameErr, "Enter your name");
        regName.classList.add("input-error");
        shake(regName);
        return;
    }


    // Проверка пароля 
    if (password.length < 8) {
        showError(passErr, "Password must contain at least 8 characters");
        regPassword.classList.add("input-error");
        shake(regPassword);
        return;
    }

    // Успешная регистрация 
    fetch("https://diplom-r1b8.onrender.com/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username, password })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            showError(userErr, data.error);
            regUsername.classList.add("input-error");
            shake(regUsername);
            return;
        }

        
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));

        currentUser = data.user.username;

        registerModal?.classList.add("hidden");
        updateProfileButton();
        updateSignoutVisibility();

        window.location.href = `profile.html?user=${currentUser}`;
    });

}


/*  ВЫХОД */

signoutSidebar?.addEventListener("click", () => {
    currentUser = null;

    localStorage.removeItem("user");
    localStorage.removeItem("token");

    updateProfileButton();
    updateSignoutVisibility();

    window.location.href = "index.html";
});



/* МОДАЛКА РЕДАКТИРОВАНИЯ */

const openEditModal = document.getElementById("openEditModal");
const editProfileModal = document.getElementById("editProfileModal");
const closeEditModal = document.getElementById("closeEditModal");

const editName = document.getElementById("editName");
const editUsernameField = document.getElementById("editUsername");

const editAvatarUpload = document.getElementById("editAvatarUpload");
const editAvatarPreview = document.getElementById("editAvatarPreview");
const removeAvatarBtn = document.getElementById("removeAvatarBtn");

const saveProfile = document.getElementById("saveProfile");


if (openEditModal && editProfileModal) {

    let avatarRemoved = false;

    openEditModal.addEventListener("click", () => {

        avatarRemoved = false;
        editProfileModal.classList.remove("hidden");

        // очистка ошибок при открытии
        const nameError = document.getElementById("editNameError");
        const userError = document.getElementById("editUserError");

        hideError(nameError);
        hideError(userError);

        editName.classList.remove("input-error");
        editUsernameField.classList.remove("input-error");

        const backendUserRaw = localStorage.getItem("user");
        const backendUser = backendUserRaw ? JSON.parse(backendUserRaw) : null;

        if (!backendUser) return;

        editName.value = backendUser.name;
        editUsernameField.value = backendUser.username;

        // 🔥 дефолтная аватарка
        if (backendUser.avatar) {
            editAvatarPreview.src = backendUser.avatar;
        } else {
            editAvatarPreview.src = "images/default-avatar.png";
        }
    });


    closeEditModal?.addEventListener("click", () => {
        editProfileModal.classList.add("hidden");

        // очистка ошибок
        const nameError = document.getElementById("editNameError");
        const userError = document.getElementById("editUserError");

        hideError(nameError);
        hideError(userError);

        editName.classList.remove("input-error");
        editUsernameField.classList.remove("input-error");
    });

    document.querySelector(".edit-avatar-wrapper")?.addEventListener("click", () => {
        editAvatarUpload.click();
    });

    editAvatarUpload?.addEventListener("change", () => {
        const file = editAvatarUpload.files[0];
        if (!file) return;

        avatarRemoved = false; // если выбрали новый файл — отменяем удаление

        const reader = new FileReader();
        reader.onload = () => {
            editAvatarPreview.src = reader.result;
        };
        reader.readAsDataURL(file);
    });

    // 🔥 КНОПКА УДАЛЕНИЯ АВАТАРА
    removeAvatarBtn?.addEventListener("click", () => {
        avatarRemoved = true;
        editAvatarPreview.src = "images/default-avatar.png";
    });
    
    // очистка ошибок при вводе
    editName?.addEventListener("input", () => {
        const nameError = document.getElementById("editNameError");
        hideError(nameError);
        editName.classList.remove("input-error");
    });

    editUsernameField?.addEventListener("input", () => {
        const userError = document.getElementById("editUserError");
        hideError(userError);
        editUsernameField.classList.remove("input-error");
    });

    saveProfile?.addEventListener("click", async () => {
        const newName = editName.value.trim();
        const newUsername = editUsernameField.value.trim().toLowerCase();

        const nameError = document.getElementById("editNameError");
        const userError = document.getElementById("editUserError");

        nameError.textContent = "";
        userError.textContent = "";

        editName.classList.remove("input-error");
        editUsernameField.classList.remove("input-error");

        if (newName.length < 2) {
            nameError.textContent = "Name too short";
            editName.classList.add("input-error");
            shake(editName);
            return;
        }

        if (newUsername.length < 3) {
            userError.textContent = "Username too short";
            editUsernameField.classList.add("input-error");
            shake(editUsernameField);
            return;
        }

        const usernameRegex = /^[a-z0-9_]+$/;
        if (!usernameRegex.test(newUsername)) {
            userError.textContent = "Only latin letters, numbers and _ allowed";
            editUsernameField.classList.add("input-error");
            shake(editUsernameField);
            return;
        }

        const token = localStorage.getItem("token");
        const formData = new FormData();

        formData.append("name", newName);
        formData.append("username", newUsername);

        // 🔥 логика удаления / загрузки
        if (avatarRemoved) {
            formData.append("avatar", "REMOVE");
        } else if (editAvatarUpload.files[0]) {
            formData.append("avatar", editAvatarUpload.files[0]);
        }

        const res = await fetch("https://diplom-r1b8.onrender.com/api/profile/me", {
            method: "PUT",
            headers: {
                "Authorization": "Bearer " + token
            },
            body: formData
        });

        const data = await res.json();

        if (!res.ok) {
            if ((data.error || "").toLowerCase().includes("username")) {
                userError.textContent = data.error || "Update failed";
                editUsernameField.classList.add("input-error");
                shake(editUsernameField);
            } else {
                nameError.textContent = data.error || "Update failed";
                editName.classList.add("input-error");
                shake(editName);
            }
            return;
        }

        localStorage.setItem("user", JSON.stringify(data));
        currentUser = data.username;

        location.href = `profile.html?user=${data.username}`;
    });

}



function generateID() {
    return "anim-" + Math.random().toString(36).substr(2, 9);
}



function createVideoThumbnail(file) {
    return new Promise((resolve) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.src = URL.createObjectURL(file);

        video.onloadeddata = () => {
            const canvas = document.createElement("canvas");
            canvas.width = 320;
            canvas.height = 180;
            const ctx = canvas.getContext("2d");

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => resolve(blob), "image/webp", 0.7);
        };
    });
}





function createPNGThumbnail(file) {
    return new Promise(async (resolve) => {
        const blobURL = URL.createObjectURL(file);
        const img = new Image();
        img.src = blobURL;

        img.onload = () => {
            const canvas = document.createElement("canvas");
            const scale = 320 / img.width;
            canvas.width = 320;
            canvas.height = img.height * scale;

            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            canvas.toBlob((blob) => resolve(blob), "image/webp", 0.7);
        };
    });
}



async function setupUploadPage() {
    if (!location.pathname.includes("upload.html")) return;
    if (!requireAuth()) return;


    const urlParams = new URLSearchParams(location.search);
    const editID = urlParams.get("id");

    const nameInput = document.getElementById("animationName");
    const descriptionInput = document.getElementById("animationDescription");
    const title = document.getElementById("uploadTitle");

    const mp4Btn = document.getElementById("uploadMP4Btn");
    const pngBtn = document.getElementById("uploadPNGBtn");

    const mp4Input = document.getElementById("mp4Input");
    const pngInput = document.getElementById("pngInput");

    const mp4Preview = document.getElementById("mp4Preview");
    const pngPreview = document.getElementById("pngPreview");
    const pngPreviewImg = document.getElementById("pngPreviewImg");



    const saveBtn = document.getElementById("saveAnimationBtn");
    const uploadStatus = document.getElementById("uploadStatus");
    const uploadProgressBar = document.getElementById("uploadProgressBar");
    const uploadStatusText = document.querySelector(".upload-status-text");

    const mp4ProgressBox = document.getElementById("mp4ProgressBox");
    const mp4Progress = document.getElementById("mp4Progress");

    const pngProgressBox = document.getElementById("pngProgressBox");
    const pngProgress = document.getElementById("pngProgress");

    let loadedMP4 = null;
    let loadedPNGs = [];
    let thumbnail = null;
    let currentPngIndex = 0;


  



    if (editID) {
        title.innerText = "Edit animation";

    }

 

    mp4Btn.onclick = () => mp4Input.click();
    pngBtn.onclick = () => pngInput.click();

    // MP4 загрузка
    mp4Input.onchange = async () => {
        const file = mp4Input.files[0];
        if (!file) return;

        mp4ProgressBox.style.display = "block";

    
        let progress = 0;
        const interval = setInterval(() => {
            progress += 10;
            mp4Progress.style.width = progress + "%";
            if (progress >= 100) clearInterval(interval);
        }, 60);

        loadedMP4 = file;
        thumbnail = await createVideoThumbnail(file);

        mp4Preview.src = URL.createObjectURL(file);
        mp4Preview.style.display = "block";

        //pngPreview.style.display = "none";
    };

    // PNG загрузка
    pngInput.onchange = async () => {
        const files = [...pngInput.files];
        if (!files.length) return;

        // сортировка файлов
        files.sort((a, b) => a.name.localeCompare(b.name));

        pngProgressBox.style.display = "block";

        loadedPNGs = [];
        let index = 0;

        for (const file of files) {
            loadedPNGs.push(file);
            index++;

            const percent = Math.round((index / files.length) * 100);
            pngProgress.style.width = percent + "%";
        }

        thumbnail = await createPNGThumbnail(files[0]);

        currentPngIndex = 0;

        pngPreview.style.display = "block";

        pngPreviewImg.src = URL.createObjectURL(loadedPNGs[currentPngIndex]);

        thumbnail = await createPNGThumbnail(loadedPNGs[currentPngIndex]);

    };

    const pngPrev = document.getElementById("pngPrev");
    const pngNext = document.getElementById("pngNext");
    const pngCounter = document.getElementById("pngCounter");
    const setPngCoverBtn = document.getElementById("setPngCoverBtn");

    function updatePngPreview() {
        if (!loadedPNGs.length) return;

        pngPreviewImg.src = URL.createObjectURL(loadedPNGs[currentPngIndex]);

        pngCounter.textContent = `${currentPngIndex + 1} / ${loadedPNGs.length}`;
    }

    pngPrev?.addEventListener("click", () => {
        if (!loadedPNGs.length) return;
        currentPngIndex =
            (currentPngIndex - 1 + loadedPNGs.length) % loadedPNGs.length;
        updatePngPreview();
    });

    pngNext?.addEventListener("click", () => {
        if (!loadedPNGs.length) return;
        currentPngIndex =
            (currentPngIndex + 1) % loadedPNGs.length;
        updatePngPreview();
    });

    pngPreviewImg?.addEventListener("wheel", (e) => {
        e.preventDefault();
        if (!loadedPNGs.length) return;

        if (e.deltaY > 0) {
            // вперёд
            currentPngIndex =
                (currentPngIndex + 1) % loadedPNGs.length;
        } else {
            // назад
            currentPngIndex =
                (currentPngIndex - 1 + loadedPNGs.length) % loadedPNGs.length;
        }

        updatePngPreview();
    });

    setPngCoverBtn?.addEventListener("click", async () => {
        if (!loadedPNGs.length) {
            alert("PNG sequence not loaded");
            return;
        }

        const file = loadedPNGs[currentPngIndex];
        thumbnail = await createPNGThumbnail(file);

        showToast("Cover updated");

    });


    /* СОХРАНЕНИЕ */

    saveBtn.onclick = async () => {
        saveBtn.disabled = true;
        saveBtn.textContent = "Uploading...";

        const name = nameInput.value.trim();

        const nameError = document.getElementById("nameError");
        const mp4Error = document.getElementById("mp4Error");
        const pngError = document.getElementById("pngError");

        // очистка ошибок
        hideError(nameError);
        hideError(mp4Error);
        hideError(pngError);

        nameInput.classList.remove("input-error");
        mp4Btn.classList.remove("input-error");
        pngBtn.classList.remove("input-error");

        let firstErrorEl = null;

        // name
        if (!name) {
            showError(nameError, "Enter animation name");
            nameInput.classList.add("input-error");
            firstErrorEl = nameInput;
        }

        // mp4
        if (!loadedMP4) {
            showError(mp4Error, "Upload MP4 file");
            mp4Btn.classList.add("input-error");
            firstErrorEl ??= mp4Btn;
        }

        // png
        if (loadedPNGs.length === 0) {
            showError(pngError, "Upload PNG sequence");
            pngBtn.classList.add("input-error");
            firstErrorEl ??= pngBtn;
        }

        if (firstErrorEl) {
            showError(firstErrorEl.nextElementSibling, firstErrorEl.nextElementSibling.textContent);
            firstErrorEl.scrollIntoView({ behavior: "smooth", block: "center" });
            shake(firstErrorEl);
            return;
        }


        const token = localStorage.getItem("token");

        try {
            const formData = new FormData();

            formData.append("title", name);
            formData.append("description", descriptionInput.value.trim());

            formData.append("video", loadedMP4);

            loadedPNGs.forEach(file => {
                formData.append("frames", file);
            });

            if (thumbnail) {
                formData.append("cover", thumbnail, "cover.webp");
            }

            uploadStatus.classList.remove("hidden");

            const xhr = new XMLHttpRequest();

            xhr.open(
                "POST",
                "https://diplom-r1b8.onrender.com/api/animations"
            );

            xhr.setRequestHeader(
                "Authorization",
                "Bearer " + token
            );

            xhr.upload.onprogress = (e) => {

                if (!e.lengthComputable) return;

                const percent = Math.round((e.loaded / e.total) * 100);

                uploadProgressBar.style.width = percent + "%";

                uploadStatusText.textContent =
                    `Uploading... ${percent}%`;
            };

            xhr.onload = () => {

                let result = {};

                try {
                    result = JSON.parse(xhr.responseText);
                } catch {}

                if (xhr.status >= 200 && xhr.status < 300) {

                    location.href =
                        `profile.html?user=${currentUser}`;

                } else {

                    console.error("UPLOAD ERROR:", result);

                    alert(result.error || "Upload failed");

                    uploadStatus.classList.add("hidden");

                    saveBtn.disabled = false;
                    saveBtn.textContent = "Save animation";
                }
            };

            xhr.onerror = () => {

                alert("Connection error");

                uploadStatus.classList.add("hidden");

                saveBtn.disabled = false;
                saveBtn.textContent = "Save animation";
            };

            xhr.send(formData);

        } catch (e) {
            alert("Ошибка соединения с сервером");
            console.error(e);
        }
        

    };
}

/* ПРОФИЛЬ */

async function setupProfilePage() {
    if (!location.pathname.includes("profile.html")) return;
    if (!requireAuth()) return;


    const params = new URLSearchParams(location.search);
    const profileUser = params.get("user") || currentUser;

  
    let userProfile;

    try {
        const res = await fetch(`https://diplom-r1b8.onrender.com/api/users/${profileUser}`);
        if (!res.ok) throw new Error();

        userProfile = await res.json();
    } catch {
        alert("User not found");
        location.href = "works.html";
        return;
    }


    if (!profileUser) {
        alert("User not found");
        location.href = "works.html";
        return;
    }

    const isOwnProfile = profileUser === currentUser;
   
    if (!isOwnProfile) {
        document.getElementById("openEditModal")?.remove();
        document.getElementById("goUpload")?.remove();
    }


    const displayName = document.getElementById("displayName");
    const displayUsername = document.getElementById("displayUsername");
    const avatarPreview = document.getElementById("avatarPreview");

    displayName.textContent = userProfile.name;
    displayUsername.textContent = "@" + userProfile.username;



    if (userProfile.avatar) {
    avatarPreview.src = userProfile.avatar;
    } else {
        avatarPreview.src = "images/default-avatar.png";
    }

    avatarPreview.style.display = "block";




    const grid = document.getElementById("animationGrid");
    const goUpload = document.getElementById("goUpload");
    const editBtn = document.getElementById("openEditModal");

    if (isOwnProfile) {
        if (goUpload) {
            goUpload.onclick = () => {
                if (!requireAuth()) return;
                location.href = "upload.html";
            };
        }
    }
    else {
        goUpload?.remove();
        editBtn?.remove();
    }


    let animations = [];

    try {
        const res = await fetch(
            `https://diplom-r1b8.onrender.com/api/users/${profileUser}/animations`
        );
        animations = await res.json();
    } catch (err) {
        console.error(err);
        alert("Failed to load animations");
    }



    grid.innerHTML = "";

    animations.forEach(anim => {
        const card = document.createElement("div");
        card.className = "animation-card";

        const item = document.createElement("div");
        item.className = "animation-item";

        const img = document.createElement("img");
        img.src = anim.cover_path;


        const titleEl = document.createElement("div");
        titleEl.className = "anim-title";

        titleEl.innerText = anim.title;
        titleEl.title = anim.title;

        const menu = document.createElement("div");
        menu.className = "anim-menu";

        const edit = document.createElement("div");
        edit.innerText = "edit";
        edit.onclick = (e) => {
            e.stopPropagation();
            location.href = `upload.html?id=${anim.id}`;
        };

        const del = document.createElement("div");
        del.innerText = "delete";
        del.onclick = (e) => {
            e.stopPropagation();
            openDeletePopup(anim.id);
        };

        if (isOwnProfile) {
        menu.append(edit, del);
        item.append(img, menu);
        } else {
            item.append(img); // без меню
        }


        card.append(item, titleEl);

        item.onclick = () => {
            location.href = `viewer.html?id=${anim.id}`;
        };

        grid.append(card);
    });


 

    const popup = document.getElementById("deletePopup");
    const confirmBtn = document.getElementById("confirmDelete");
    const cancelBtn = document.getElementById("cancelDelete");

    let pendingDelete = null;

    function openDeletePopup(id) {
        pendingDelete = id;
        popup.style.display = "flex";
    }

    function closePopup() {
        popup.style.display = "none";
    }

    cancelBtn.onclick = closePopup;

    confirmBtn.onclick = async () => {
        const res = await fetch(`https://diplom-r1b8.onrender.com/api/animations/${pendingDelete}`, {
            method: "DELETE",
            headers: {
                "Authorization": "Bearer " + localStorage.getItem("token")
            }
        });

        if (!res.ok) {
            alert("Delete failed");
            return;
        }

        closePopup();
        location.reload();
    };
}

/* ПРОСМОТР */

async function setupViewerPage() {
    if (!location.pathname.includes("viewer.html")) return;

    const urlParams = new URLSearchParams(location.search);
    const id = urlParams.get("id");

    const titleEl = document.getElementById("animTitle");
    const authorEl = document.getElementById("animAuthor");
    const descEl = document.getElementById("animDescription");

    const videoEl = document.getElementById("viewerVideo");
    const imgEl = document.getElementById("viewerImg");

    const btnVideo = document.getElementById("switchVideo");
    const btnPNG = document.getElementById("switchPNG");

    const arrowLeft = document.getElementById("arrowLeft");
    const arrowRight = document.getElementById("arrowRight");
    const frameCounter = document.getElementById("frameCounter");
    const speedControl = document.getElementById("speedControl");

    const speedSelect = speedControl?.querySelector("select");

    speedSelect?.addEventListener("change", () => {
        const speed = parseFloat(speedSelect.value);
        videoEl.playbackRate = speed;
    });

    let frames = [];
    let currentFrame = 0;

    try {
        const res = await fetch(`https://diplom-r1b8.onrender.com/api/animations/${id}`);
        if (!res.ok) {
            alert("Animation not found");
            return;
        }

        const anim = await res.json();

        titleEl.textContent = anim.title || "Untitled animation";
        authorEl.textContent = "@" + (anim.author_username || "unknown");
        authorEl.href = `profile.html?user=${anim.author_username}`;
        descEl.textContent = anim.description || "";

        if (anim.video_path) {
            videoEl.src = anim.video_path;
            videoEl.playbackRate = 1; // дефолт
        }

        if (anim.frames && anim.frames.length) {
            frames = anim.frames || [];
        }

    } catch (err) {
        console.error(err);
        alert("Server error");
        return;
    }

    function updateFrame() {
        if (!frames.length) return;

        imgEl.src = frames[currentFrame];
        frameCounter.textContent = `${currentFrame + 1} / ${frames.length}`;
    }

    function showVideoMode() {
        videoEl.style.display = "block";
        imgEl.style.display = "none";

        arrowLeft.style.display = "none";
        arrowRight.style.display = "none";
        frameCounter.style.display = "none";

        if (speedControl) speedControl.style.display = "flex";

        btnVideo.classList.add("active");
        btnPNG.classList.remove("active");
    }

    function showPNGMode() {
        if (!frames.length) return;

        videoEl.style.display = "none";
        imgEl.style.display = "block";

        arrowLeft.style.display = "flex";
        arrowRight.style.display = "flex";
        frameCounter.style.display = "block";

        if (speedControl) speedControl.style.display = "none";

        btnPNG.classList.add("active");
        btnVideo.classList.remove("active");

        updateFrame();
    }

    btnVideo?.addEventListener("click", showVideoMode);
    btnPNG?.addEventListener("click", showPNGMode);

    arrowLeft?.addEventListener("click", () => {
        if (!frames.length || imgEl.style.display === "none") return;

        currentFrame = (currentFrame - 1 + frames.length) % frames.length;
        updateFrame();
    });

    arrowRight?.addEventListener("click", () => {
        if (!frames.length || imgEl.style.display === "none") return;

        currentFrame = (currentFrame + 1) % frames.length;
        updateFrame();
    });

    imgEl?.addEventListener("wheel", (e) => {
        if (!frames.length || imgEl.style.display === "none") return;

        e.preventDefault();

        if (e.deltaY > 0) {
            currentFrame = (currentFrame + 1) % frames.length;
        } else {
            currentFrame = (currentFrame - 1 + frames.length) % frames.length;
        }

        updateFrame();
    });

    showVideoMode(); // всегда сначала видео
}

async function setupWorksPage() {
    if (!location.pathname.includes("works.html")) return;

    const worksGrid = document.getElementById("worksGrid");
    if (!worksGrid) return;

    let animations = [];

    try {
        const res = await fetch("https://diplom-r1b8.onrender.com/api/animations");
        if (!res.ok) throw new Error("Failed to load animations");
        animations = await res.json();
    } catch (err) {
        console.error(err);
        worksGrid.innerHTML = "<p>Failed to load animations</p>";
        return;
    }

    worksGrid.innerHTML = "";

    animations.forEach(anim => {
        const card = document.createElement("div");
        card.className = "animation-card";

        const item = document.createElement("div");
        item.className = "animation-item";

        
        const img = document.createElement("img");
        img.src = anim.cover_path;
        item.appendChild(img);

        item.onclick = () => {
            location.href = `viewer.html?id=${anim.id}`;
        };

        
        const titleEl = document.createElement("div");
        titleEl.className = "anim-title";
        titleEl.textContent = anim.title || "Untitled animation";

        
        const authorEl = document.createElement("div");
        authorEl.className = "anim-author";

        const username = anim.author_username || "unknown";
        authorEl.innerHTML = `<a href="profile.html?user=${username}">@${username}</a>`;

        card.append(item, titleEl, authorEl);
        worksGrid.appendChild(card);
    });
}



document.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(location.search);
    if (params.get("auth") === "signin") {
        signinModal?.classList.remove("hidden");
    }

    await setupUploadPage();
    await setupProfilePage();
    await setupViewerPage();
    await setupWorksPage();
    await setupIndexCarousel();
    await setupIndexLatest();
});


/* ГЛАВНАЯ - КАРУСЕЛЬ */

async function setupIndexCarousel() {
    if (!location.pathname.endsWith("index.html") && location.pathname !== "/") return;

    const track = document.getElementById("carouselTrack");
    if (!track) return;

    const res = await fetch("https://diplom-r1b8.onrender.com/api/animations");
    let animations = await res.json();

    if (!animations.length) return;

    // сортируем по дате (новые — первыми)
    animations.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // берём максимум 6
    animations = animations.slice(0, 6);

    // очищаем текущие квадраты
    track.innerHTML = "";

    animations.forEach(anim => {
        const item = document.createElement("div");
        item.className = "carousel-item";

        const img = document.createElement("img");
        img.src = anim.cover_path;
        img.style.width = "100%";
        img.style.height = "100%";
        img.style.objectFit = "cover";
        img.style.borderRadius = "12px";

        item.appendChild(img);

        item.onclick = () => {
            location.href = `viewer.html?id=${anim.id}`;
        };

        track.appendChild(item);
    });
    initCarouselAfterLoad();

}

function initCarouselAfterLoad() {
    const track = document.getElementById("carouselTrack");
    if (!track) return;

    const items = Array.from(track.children);
    if (items.length === 0) return;

    const itemWidth = items[0].offsetWidth + 20; 
    let index = items.length;

    // очищаем старые клоны (если есть)
    track.querySelectorAll(".clone").forEach(el => el.remove());

    // клонируем
    items.forEach(item => {
        const clone = item.cloneNode(true);
        clone.classList.add("clone");
        track.appendChild(clone);
    });

    [...items].reverse().forEach(item => {
        const clone = item.cloneNode(true);
        clone.classList.add("clone");
        track.prepend(clone);
    });

    track.style.transition = "none";
    track.style.transform = `translateX(${-index * itemWidth}px)`;

    requestAnimationFrame(() => {
        track.style.transition = "transform 0.4s ease";
    });
}

// демонстрация последних добавленных аниимаций
async function setupIndexLatest() {
    if (!location.pathname.endsWith("index.html") && location.pathname !== "/") return;


    const grid = document.getElementById("latestGrid");
    if (!grid) return;

    const res = await fetch("https://diplom-r1b8.onrender.com/api/animations");
    let animations = await res.json();

    // сортируем по дате (новые сверху)
    animations.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // берём только последние 3
    animations = animations.slice(0, 4);

    grid.innerHTML = "";

    animations.forEach(anim => {
        const card = document.createElement("div");
        card.className = "animation-card";

        const item = document.createElement("div");
        item.className = "animation-item";

        const img = document.createElement("img");
        img.src = anim.cover_path;

        item.appendChild(img);
        item.onclick = () => {
            location.href = `viewer.html?id=${anim.id}`;
        };

        const title = document.createElement("div");
        title.className = "anim-title";
        title.innerText = anim.title;
        title.title = anim.title;

        const author = document.createElement("div");
        author.className = "anim-author";
        author.innerHTML = `<a href="profile.html?user=${anim.author_username}">@${anim.author_username}</a>`;

        card.append(item, title, author);
        grid.appendChild(card);
    });
}

function showToast(text, duration = 2000) {
    const toast = document.getElementById("toast");
    if (!toast) return;

    toast.textContent = text;
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, duration);
}

function getUser() {
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

function isLoggedIn() {
  return !!localStorage.getItem('token');
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  location.reload();
}

async function login(username, password) {
  const res = await fetch('https://diplom-r1b8.onrender.com/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();

  if (data.error) {
    alert(data.error);
    return;
  }

  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));

  location.reload();
}

function requireAuth(redirect = "index.html?auth=signin") {
    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = redirect;
        return false;
    }
    return true;
}
