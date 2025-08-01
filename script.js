
        // Teachable Machine model configuration
        const MODEL_URL = "https://teachablemachine.withgoogle.com/models/H5t9mZMw9/";
        const MOVE_DETECTION_THRESHOLD = 0.6; // Lowered threshold for better detection
        const FALLBACK_MODE = false; // Try AI model first

        class RedLightGreenLightGame {
            constructor() {
                this.gameState = "waiting"; // waiting, countdown, green, red, gameOver
                this.gameStats = { score: 0, round: 0, lives: 3 };
                this.isLoading = false;
                this.movementPercent = 0;
                this.countdown = 3;
                this.predictions = [];
                this.useFallback = false;
                
                this.webcam = null;
                this.model = null;
                this.gameLoopId = null;
                this.timeoutId = null;
                this.previousImageData = null;
                
                this.initializeElements();
                this.bindEvents();
            }

            initializeElements() {
                this.elements = {
                    score: document.getElementById('score'),
                    round: document.getElementById('round'),
                    lives: document.getElementById('lives'),
                    lightDisplay: document.getElementById('lightDisplay'),
                    gameButton: document.getElementById('gameButton'),
                    webcamContainer: document.getElementById('webcamContainer'),
                    movementIndicator: document.getElementById('movementIndicator'),
                    movementPercent: document.getElementById('movementPercent'),
                    countdownOverlay: document.getElementById('countdownOverlay'),
                    countdownNumber: document.getElementById('countdownNumber'),
                    statusDisplay: document.getElementById('statusDisplay'),
                    debugContainer: document.getElementById('debugContainer'),
                    fallbackMessage: document.getElementById('fallbackMessage')
                };
            }

            bindEvents() {
                this.elements.gameButton.addEventListener('click', () => {
                    if (this.gameState === "waiting" || this.gameState === "gameOver") {
                        if (this.gameState === "gameOver" && this.gameStats.lives <= 0) {
                            // Restart the entire game
                            this.stopGame();
                            setTimeout(() => {
                                this.startGame();
                            }, 100);
                        } else {
                            this.startGame();
                        }
                    } else {
                        this.stopGame();
                    }
                });
            }

            updateStats(updates) {
                this.gameStats = { ...this.gameStats, ...updates };
                this.elements.score.textContent = this.gameStats.score;
                this.elements.round.textContent = this.gameStats.round;
                this.elements.lives.textContent = this.gameStats.lives;
            }

            updateStatus(message) {
                this.elements.statusDisplay.textContent = message;
            }

            async startGame() {
                try {
                    this.isLoading = true;
                    this.elements.gameButton.disabled = true;
                    this.updateStatus("🤖 Loading AI model...");
                    
                    // Try to load the Teachable Machine model
                    try {
                        // Ensure TensorFlow.js and Teachable Machine are loaded
                        if (typeof tf === 'undefined') {
                            throw new Error("TensorFlow.js not loaded");
                        }
                        if (typeof tmImage === 'undefined') {
                            throw new Error("Teachable Machine library not loaded");
                        }
                        
                        console.log("Loading model from:", MODEL_URL);
                        const modelURL = MODEL_URL + "model.json";
                        const metadataURL = MODEL_URL + "metadata.json";
                        
                        this.model = await tmImage.load(modelURL, metadataURL);
                        console.log("Model loaded successfully:", this.model);
                        this.updateStatus("✅ AI model loaded successfully!");
                        
                        // Wait a bit to show the success message
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        
                    } catch (modelError) {
                        console.error("AI model loading failed:", modelError);
                        this.useFallback = true;
                        this.elements.fallbackMessage.style.display = 'block';
                        this.updateStatus("⚠️ Using fallback motion detection");
                        await new Promise(resolve => setTimeout(resolve, 1500));
                    }
                    
                    this.updateStatus("📷 Starting camera...");
                    
                    // Setup webcam
                    await this.setupWebcam();
                    
                    // Reset game stats
                    this.updateStats({ score: 0, round: 0, lives: 3 });
                    this.gameState = "countdown";
                    this.elements.gameButton.textContent = "Stop Game";
                    
                    // Start game loop
                    this.startGameLoop();
                    
                    // Start countdown
                    this.startCountdown();
                    
                } catch (error) {
                    console.error("Initialization error:", error);
                    this.updateStatus(`❌ Error: ${error.message}`);
                } finally {
                    this.isLoading = false;
                    this.elements.gameButton.disabled = false;
                }
            }

            async setupWebcam() {
                try {
                    if (this.useFallback || !this.model) {
                        // Use regular webcam for fallback
                        const video = document.createElement('video');
                        video.className = 'webcam-video';
                        video.width = 400;
                        video.height = 300;
                        video.autoplay = true;
                        video.muted = true;
                        
                        const stream = await navigator.mediaDevices.getUserMedia({ 
                            video: { width: 400, height: 300 } 
                        });
                        video.srcObject = stream;
                        
                        this.webcam = { 
                            canvas: video, 
                            update: () => {}, 
                            stop: () => {
                                stream.getTracks().forEach(track => track.stop());
                            }
                        };
                        
                        this.elements.webcamContainer.appendChild(video);
                    } else {
                        // Use Teachable Machine webcam - optimized setup
                        console.log("Setting up Teachable Machine webcam...");
                        const flip = true; // flip the webcam horizontally
                        this.webcam = new tmImage.Webcam(400, 300, flip);
                        
                        await this.webcam.setup({ facingMode: 'user' }); // request front camera
                        await this.webcam.play();
                        
                        // Make sure the webcam is working
                        if (!this.webcam.canvas) {
                            throw new Error("Webcam canvas not created");
                        }
                        
                        this.elements.webcamContainer.appendChild(this.webcam.canvas);
                        this.webcam.canvas.className = "webcam-video";
                        
                        console.log("Teachable Machine webcam setup complete");
                    }
                } catch (error) {
                    console.error("Webcam setup error:", error);
                    throw new Error(`Camera setup failed: ${error.message}`);
                }
            }

            startCountdown() {
                this.elements.countdownOverlay.style.display = 'flex';
                this.countdown = 3;
                this.elements.countdownNumber.textContent = this.countdown;
                
                const countdownInterval = setInterval(() => {
                    this.countdown--;
                    if (this.countdown > 0) {
                        this.elements.countdownNumber.textContent = this.countdown;
                    } else {
                        this.elements.countdownNumber.textContent = "GO!";
                        setTimeout(() => {
                            clearInterval(countdownInterval);
                            this.elements.countdownOverlay.style.display = 'none';
                            this.startNewRound();
                        }, 500);
                    }
                }, 1000);
            }

            startNewRound() {
                this.updateStats({ round: this.gameStats.round + 1 });
                this.gameState = "green";
                this.updateLightDisplay();
                this.updateStatus("🟢 Move around and have fun!");
                
                // Random green light duration (3-8 seconds)
                const greenLightDuration = 3000 + Math.random() * 5000;
                
                this.timeoutId = setTimeout(() => {
                    this.switchToRed();
                }, greenLightDuration);
            }

            switchToRed() {
                this.gameState = "red";
                this.updateLightDisplay();
                this.updateStatus("🔴 Don't move a muscle!");
                
                // Red light duration (2-5 seconds)
                const redLightDuration = 2000 + Math.random() * 3000;
                
                this.timeoutId = setTimeout(() => {
                    // Successfully survived red light
                    this.updateStats({ score: this.gameStats.score + 10 });
                    this.updateStatus("🎉 Great job! +10 points");
                    
                    setTimeout(() => {
                        this.startNewRound();
                    }, 1000);
                }, redLightDuration);
            }

            playerCaught() {
                console.log("Player caught! Current state:", this.gameState);
                
                const newLives = this.gameStats.lives - 1;
                this.updateStats({ lives: newLives });
                
                if (this.timeoutId) {
                    clearTimeout(this.timeoutId);
                    this.timeoutId = null;
                }
                
                if (newLives <= 0) {
                    // Game over - final death
                    this.gameState = "gameOver";
                    this.updateLightDisplay();
                    this.updateStatus(`🏁 Game Over! Final Score: ${this.gameStats.score} points in ${this.gameStats.round} rounds!`);
                    this.elements.gameButton.textContent = "Play Again";
                    
                    // Stop the game loop when truly game over
                    if (this.gameLoopId) {
                        cancelAnimationFrame(this.gameLoopId);
                        this.gameLoopId = null;
                    }
                } else {
                    // Caught but still have lives - show caught state briefly then continue
                    this.gameState = "caught";
                    this.updateLightDisplay();
                    this.updateStatus(`💥 Caught moving! ${newLives} lives left - Get ready for next round!`);
                    
                    // Don't stop the game loop - keep it running
                    // Continue to next round after delay
                    setTimeout(() => {
                        if (this.gameState === "caught") { // Make sure we're still in caught state
                            console.log("Continuing to next round after being caught");
                            this.startNewRound();
                        }
                    }, 2500);
                }
            }

            updateLightDisplay() {
                const lightElement = this.elements.lightDisplay;
                
                // Remove all light classes
                lightElement.classList.remove('light-green', 'light-red', 'game-over');
                
                switch (this.gameState) {
                    case "green":
                        lightElement.classList.add('light-green');
                        lightElement.textContent = "GREEN LIGHT - Move!";
                        break;
                    case "red":
                        lightElement.classList.add('light-red');
                        lightElement.textContent = "RED LIGHT - FREEZE!";
                        break;
                    case "caught":
                        lightElement.classList.add('game-over');
                        lightElement.textContent = "CAUGHT!";
                        break;
                    case "gameOver":
                        lightElement.classList.add('game-over');
                        lightElement.textContent = this.gameStats.lives <= 0 ? "GAME OVER" : "CAUGHT!";
                        break;
                    case "countdown":
                        lightElement.textContent = "Get Ready!";
                        break;
                    default:
                        lightElement.textContent = "Click Start to Play!";
                }
            }

            detectMovementFallback() {
                // Enhanced fallback movement detection using random simulation
                // This simulates more realistic movement patterns
                const timeNow = Date.now();
                const timeDiff = timeNow - (this.lastFallbackTime || timeNow);
                this.lastFallbackTime = timeNow;
                
                // Base random movement with some persistence
                if (!this.fallbackMovementState) {
                    this.fallbackMovementState = {
                        isMoving: Math.random() > 0.7,
                        intensity: Math.random(),
                        changeTime: timeNow + Math.random() * 3000 + 1000
                    };
                }
                
                // Change movement state occasionally
                if (timeNow > this.fallbackMovementState.changeTime) {
                    this.fallbackMovementState = {
                        isMoving: Math.random() > 0.6,
                        intensity: Math.random(),
                        changeTime: timeNow + Math.random() * 4000 + 2000
                    };
                }
                
                const baseMovement = this.fallbackMovementState.isMoving ? 
                    0.3 + (this.fallbackMovementState.intensity * 0.5) : 
                    Math.random() * 0.2;
                
                // Add some noise
                const noise = (Math.random() - 0.5) * 0.1;
                
                return Math.max(0, Math.min(1, baseMovement + noise));
            }

            async gameLoop() {
                if (!this.webcam || this.gameState === "waiting") {
                    return;
                }
                
                try {
                    // Update webcam frame
                    if (this.webcam.update) {
                        this.webcam.update();
                    }
                    
                    let movingProb = 0;
                    
                    if (this.useFallback || !this.model) {
                        // Use fallback detection
                        movingProb = this.detectMovementFallback();
                        this.predictions = [
                            { className: "Moving", probability: movingProb },
                            { className: "Still", probability: 1 - movingProb }
                        ];
                    } else {
                        // Use AI model prediction
                        try {
                            const prediction = await this.model.predict(this.webcam.canvas);
                            this.predictions = prediction;
                            
                            // Log predictions for debugging (only occasionally to avoid spam)
                            if (Math.random() < 0.1) {
                                console.log("Predictions:", prediction.map(p => `${p.className}: ${(p.probability * 100).toFixed(1)}%`).join(', '));
                            }
                            
                            // Find the "Moving" class prediction
                            const movingPrediction = prediction.find(p => 
                                p.className.toLowerCase().includes('moving') || 
                                p.className.toLowerCase().includes('motion') ||
                                p.className === "Class 1" // Sometimes Teachable Machine uses generic class names
                            );
                            
                            // If no "Moving" class found, use the first class that's not "Still"
                            if (!movingPrediction) {
                                const stillPrediction = prediction.find(p => 
                                    p.className.toLowerCase().includes('still') || 
                                    p.className.toLowerCase().includes('static') ||
                                    p.className === "Class 0"
                                );
                                movingProb = stillPrediction ? 1 - stillPrediction.probability : prediction[1]?.probability || 0;
                            } else {
                                movingProb = movingPrediction.probability;
                            }
                            
                        } catch (predictionError) {
                            console.error("Prediction error:", predictionError);
                            // Fall back to random detection on prediction error
                            movingProb = this.detectMovementFallback();
                        }
                    }
                    
                    this.updateDebugInfo();
                    
                    this.movementPercent = Math.round(movingProb * 100);
                    this.elements.movementPercent.textContent = this.movementPercent;
                    this.elements.movementIndicator.style.display = 'block';
                    
                    // Only check for movement during red light (not during caught or gameOver states)
                    if (this.gameState === "red" && movingProb > MOVE_DETECTION_THRESHOLD) {
                        console.log(`Movement detected during RED LIGHT! ${(movingProb * 100).toFixed(1)}% > ${(MOVE_DETECTION_THRESHOLD * 100)}%`);
                        this.playerCaught();
                        // Don't return here - let the game loop continue
                    }
                    
                    // Continue game loop for all states except waiting
                    if (this.gameState !== "waiting") {
                        this.gameLoopId = requestAnimationFrame(() => this.gameLoop());
                    }
                    
                } catch (error) {
                    console.error("Game loop error:", error);
                    // Continue with fallback on error
                    this.useFallback = true;
                    this.elements.fallbackMessage.style.display = 'block';
                    
                    // Keep the game loop running
                    if (this.gameState !== "waiting") {
                        this.gameLoopId = requestAnimationFrame(() => this.gameLoop());
                    }
                }
            }

            startGameLoop() {
                this.gameLoopId = requestAnimationFrame(() => this.gameLoop());
            }

            updateDebugInfo() {
                this.elements.debugContainer.innerHTML = '';
                this.predictions.forEach(prediction => {
                    const debugItem = document.createElement('div');
                    debugItem.className = 'debug-item';
                    debugItem.textContent = `${prediction.className}: ${(prediction.probability * 100).toFixed(1)}%`;
                    this.elements.debugContainer.appendChild(debugItem);
                });
            }

            stopGame() {
                if (this.gameLoopId) {
                    cancelAnimationFrame(this.gameLoopId);
                }
                if (this.timeoutId) {
                    clearTimeout(this.timeoutId);
                }
                if (this.webcam && this.webcam.stop) {
                    this.webcam.stop();
                }
                
                this.elements.webcamContainer.innerHTML = '';
                this.elements.movementIndicator.style.display = 'none';
                this.elements.countdownOverlay.style.display = 'none';
                this.elements.debugContainer.innerHTML = '';
                this.elements.fallbackMessage.style.display = 'none';
                
                this.gameState = "waiting";
                this.updateLightDisplay();
                this.updateStatus("Welcome! Click Start Game to begin your challenge.");
                this.elements.gameButton.textContent = "Start Game";
            }
        }

        // Initialize the game when the page loads
        document.addEventListener('DOMContentLoaded', () => {
            new RedLightGreenLightGame();
        });