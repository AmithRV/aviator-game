let highScore = 0;

document.addEventListener("DOMContentLoaded", function () {
  //
  // Game elements
  const plane = document.getElementById("plane");
  const scoreElement = document.getElementById("score");
  const fuelLevel = document.getElementById("fuel-level");
  const soundIcon = document.getElementById("sound-icon");
  const startScreen = document.getElementById("start-screen");
  const gameOverScreen = document.getElementById("game-over");
  const startButton = document.getElementById("start-button");
  const soundToggle = document.getElementById("sound-toggle");
  const gameContainer = document.getElementById("game-container");
  const restartButton = document.getElementById("restart-button");
  const finalScoreElement = document.getElementById("final-score");
  const highScore = document.getElementById("high-score");
  const highScoreContainer = document.getElementById(
    "new-high-score-container"
  );

  // Game variables
  let gameRunning = false;
  let score = 0;
  let planeY;
  let fuel = 100;
  let obstacles = [];
  let fuelCans = [];
  let clouds = [];
  let gameSpeed = 2;
  let lastObstacleTime = 0;
  let lastFuelTime = 0;
  let lastCloudTime = 0;
  let animationFrameId;
  let soundEnabled = true;
  let engineSound;
  let lastFuelWarningTime = 0;
  let highScoreValue = 0;

  // Sound effects using Web Audio API
  const audioContext = new window.AudioContext();

  // Load sounds
  const sounds = {};

  function fetchData() {
    fetch("https://67e90e36bdcaa2b7f5b87194.mockapi.io/scores")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json(); // Convert to JSON
      })
      .then((response = []) => {
        // Find the highest score
        const highestScore = response.reduce(
          (max, user) => Math.max(max, Number(user.score)),
          0
        );

        highScore.textContent = highestScore;
        highScoreValue = highestScore;
      });
  }
  fetchData();

  function createOscillator(type, frequency, duration, volume = 1.0) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gainNode.gain.value = volume;

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + duration
    );
    oscillator.stop(audioContext.currentTime + duration);

    return oscillator;
  }

  // Sound effects
  function playSound(type) {
    if (!soundEnabled) return;

    switch (type) {
      case "start":
        createOscillator("sine", 440, 0.2, 0.3);
        setTimeout(() => createOscillator("sine", 660, 0.2, 0.3), 200);
        setTimeout(() => createOscillator("sine", 880, 0.3, 0.3), 400);
        break;
      case "collect":
        createOscillator("sine", 880, 0.1, 0.2);
        setTimeout(() => createOscillator("sine", 1320, 0.2, 0.2), 100);
        break;
      case "crash":
        createOscillator("sawtooth", 220, 0.3, 0.5);
        setTimeout(() => createOscillator("sawtooth", 110, 0.5, 0.5), 100);
        break;
      case "move":
        createOscillator("sine", 440, 0.1, 0.1);
        break;
      case "lowFuel":
        createOscillator("square", 220, 0.2, 0.2);
        setTimeout(() => createOscillator("square", 196, 0.2, 0.2), 300);
        break;
    }
  }

  function startEngineSound() {
    if (!soundEnabled) return;

    engineSound = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    engineSound.type = "triangle";
    engineSound.frequency.value = 110;
    gainNode.gain.value = 0.1;

    engineSound.connect(gainNode);
    gainNode.connect(audioContext.destination);

    engineSound.start();
    return gainNode;
  }

  function stopEngineSound(gainNode) {
    if (!engineSound) return;

    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + 0.5
    );
    engineSound.stop(audioContext.currentTime + 0.5);
    engineSound = null;
  }

  // Toggle sound
  soundToggle.addEventListener("click", function () {
    soundEnabled = !soundEnabled;
    soundIcon.textContent = soundEnabled ? "🔊" : "🔇";

    if (gameRunning && soundEnabled && !engineSound) {
      engineGainNode = startEngineSound();
    } else if (!soundEnabled && engineSound) {
      stopEngineSound(engineGainNode);
    }
  });

  // Set initial plane position
  function initGame() {
    const containerHeight = gameContainer.clientHeight;

    planeY = containerHeight / 2;
    plane.style.left = "100px";
    plane.style.top = planeY + "px";

    // Reset game state
    score = 0;
    fuel = 100;
    gameSpeed = 2;

    clouds = [];
    fuelCans = [];
    obstacles = [];

    fuelLevel.style.width = "100%";
    scoreElement.textContent = "0";

    // Clear any existing obstacles, fuel cans, and clouds
    document
      .querySelectorAll(".obstacle, .fuel, .cloud")
      .forEach((el) => el.remove());
  }

  // Start the game
  function startGame() {
    gameRunning = true;
    startScreen.style.display = "none";
    initGame();
    playSound("start");

    // Start engine sound
    if (soundEnabled) {
      engineGainNode = startEngineSound();
    }

    gameLoop();
  }

  // Game over
  function endGame() {
    gameRunning = false;
    finalScoreElement.textContent = score;
    gameOverScreen.style.display = "flex";
    highScoreContainer.style.display = "none";
    playSound("crash");

    // Stop engine sound
    if (engineSound) {
      stopEngineSound(engineGainNode);
    }

    cancelAnimationFrame(animationFrameId);

    if (score > highScoreValue) {
      highScoreContainer.style.display = "flex";
      highScore.textContent = score;

      //   const data = {
      //     name: "",
      //     score: score + 2,
      //   };
      //   fetch("https://67e90e36bdcaa2b7f5b87194.mockapi.io/scores", {
      //     method: "POST",
      //     headers: {
      //       "Content-Type": "application/json",
      //     },
      //     body: JSON.stringify(data),
      //   });
    }
  }

  // Game loop
  function gameLoop(timestamp) {
    if (!gameRunning) return;

    // Update game speed based on score
    gameSpeed = 2 + Math.floor(score / 1000);

    // Generate obstacles
    if (!lastObstacleTime || timestamp - lastObstacleTime > 1500 / gameSpeed) {
      createObstacle();
      lastObstacleTime = timestamp;
    }

    // Generate fuel cans
    if (!lastFuelTime || timestamp - lastFuelTime > 3000 / gameSpeed) {
      createFuel();
      lastFuelTime = timestamp;
    }

    // Generate clouds
    if (!lastCloudTime || timestamp - lastCloudTime > 1000) {
      createCloud();
      lastCloudTime = timestamp;
    }

    // Move obstacles
    moveElements(obstacles, true);

    // Move fuel cans
    moveElements(fuelCans, true);

    // Move clouds
    moveElements(clouds, false);

    // Update score
    score += gameSpeed;
    scoreElement.textContent = Math.floor(score);

    // Reduce fuel
    fuel -= 0.1;
    fuelLevel.style.width = Math.max(0, fuel) + "%";

    // Low fuel warning sound
    if (
      fuel < 25 &&
      (!lastFuelWarningTime || timestamp - lastFuelWarningTime > 3000)
    ) {
      playSound("lowFuel");
      lastFuelWarningTime = timestamp;
    }

    if (fuel <= 0) {
      endGame();
    }

    animationFrameId = requestAnimationFrame(gameLoop);
  }

  // Create an obstacle
  function createObstacle() {
    const containerHeight = gameContainer.clientHeight;
    const containerWidth = gameContainer.clientWidth;

    const obstacle = document.createElement("div");
    obstacle.className = "obstacle";

    const height = Math.random() * 100 + 50;
    const width = 20;
    const top = Math.random() * (containerHeight - height);

    obstacle.style.width = width + "px";
    obstacle.style.height = height + "px";
    obstacle.style.left = containerWidth + "px";
    obstacle.style.top = top + "px";

    gameContainer.appendChild(obstacle);
    obstacles.push(obstacle);
  }

  // Create a fuel can
  function createFuel() {
    const containerHeight = gameContainer.clientHeight;
    const containerWidth = gameContainer.clientWidth;

    const fuelCan = document.createElement("div");
    fuelCan.className = "fuel";

    const top = Math.random() * (containerHeight - 20);

    fuelCan.style.left = containerWidth + "px";
    fuelCan.style.top = top + "px";

    gameContainer.appendChild(fuelCan);
    fuelCans.push(fuelCan);
  }

  // Create a cloud
  function createCloud() {
    const containerHeight = gameContainer.clientHeight;
    const containerWidth = gameContainer.clientWidth;

    const cloud = document.createElement("div");
    cloud.className = "cloud";

    const size = Math.random() * 50 + 30;
    const top = Math.random() * containerHeight * 0.7;

    cloud.style.width = size + "px";
    cloud.style.height = size / 2 + "px";
    cloud.style.left = containerWidth + "px";
    cloud.style.top = top + "px";

    // Add some depth with opacity
    cloud.style.opacity = 0.5 + Math.random() * 0.5;

    gameContainer.appendChild(cloud);
    clouds.push(cloud);
  }

  // Move elements (obstacles, fuel cans, clouds)
  function moveElements(elements, checkCollision) {
    const containerWidth = gameContainer.clientWidth;
    const planeRect = plane.getBoundingClientRect();

    elements.forEach((element, index) => {
      const left = parseInt(element.style.left) - gameSpeed;
      element.style.left = left + "px";

      // Remove if off screen
      if (left < -50) {
        element.remove();
        elements.splice(index, 1);
      }

      // Check for collisions only for obstacles and fuel
      if (checkCollision) {
        const elementRect = element.getBoundingClientRect();

        if (
          planeRect.left < elementRect.right &&
          planeRect.right > elementRect.left &&
          planeRect.top < elementRect.bottom &&
          planeRect.bottom > elementRect.top
        ) {
          if (element.className === "obstacle") {
            // Collision with obstacle
            endGame();
          } else if (element.className === "fuel") {
            // Collected fuel
            fuel = Math.min(100, fuel + 20);
            fuelLevel.style.width = fuel + "%";
            playSound("collect");
            element.remove();
            elements.splice(index, 1);
          }
        }
      }
    });
  }

  // Keyboard controls
  window.addEventListener("keydown", function (e) {
    if (!gameRunning) return;

    const containerHeight = gameContainer.clientHeight;

    // Move up with W or up arrow
    if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") {
      planeY = Math.max(0, planeY - 20);
      plane.style.top = planeY + "px";
      //   plane.style.transform = "rotate(-10deg)";
      playSound("move");
    }

    // Move down with S or down arrow
    if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") {
      planeY = Math.min(containerHeight - 30, planeY + 20);
      plane.style.top = planeY + "px";
      //   plane.style.transform = "rotate(10deg)";
      playSound("move");
    }
  });

  window.addEventListener("keyup", function () {
    // plane.style.transform = "rotate(0deg)";
  });

  // Start and restart buttons
  startButton.addEventListener("click", () => {
    startGame();
  });

  restartButton.addEventListener("click", function () {
    gameOverScreen.style.display = "none";
    fetchData();
    startGame();
  });
});
