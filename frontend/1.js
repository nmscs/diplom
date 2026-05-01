// демонстрация последних добавленных анимаций
const latestGrid = document.getElementById("latestGrid");
animations.forEach(anim => {
    const card = document.createElement("div");
    card.className = "animation-card";
    card.innerHTML = `
        <img src="${anim.preview}" alt="${anim.title}">
        <h3>${anim.title}</h3>
    `;
    card.onclick = () => {
        window.location.href = `/viewer.html?id=${anim.id}`;
    };
    latestGrid.appendChild(card);
});

//кнопка загрузки мп4
uploadMP4Btn.addEventListener("click", () => {
    mp4Input.click();
});
//кнопка загрузки пнг
uploadPNGBtn.addEventListener("click", () => {
    pngInput.click();
});

// приём данных
app.get("/animations", (req, res) => {
    db.all("SELECT * FROM animations", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

//режим просмотра
switchVideo.addEventListener("click", () => {
    viewerVideo.style.display = "block";
    viewerImg.style.display = "none";
});

switchPNG.addEventListener("click", () => {
    viewerVideo.style.display = "none";
    viewerImg.style.display = "block";
});


//отображение текущего кадра
function showFrame(index) {
    viewerImg.src = frames[index];
    frameCounter.textContent = `${index + 1} / ${frames.length}`;
}


// управление скоростью воспроизведения
speedSelect.addEventListener("change", () => {
    const speed = parseFloat(speedSelect.value);
    viewerVideo.playbackRate = speed;
});

