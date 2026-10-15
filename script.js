 <!-- JavaScript Game Engine Logic -->
    <script>
        // --- Canvas Setup & Scaling ---
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        const container = canvas.parentElement;

        let canvasWidth = 800;
        let canvasHeight = 360;

        function resizeCanvas() {
            canvasWidth = container.clientWidth;
            canvasHeight = container.clientHeight;
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
        }

        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        // --- Sound Effects Setup (Tone.js) ---
        let soundMuted = false;
        let audioInitialized = false;

        let laserSynth, explosionSynth;

        function initAudio() {
            if (audioInitialized) return;
            try {
                // Laser sound synthesizer
                laserSynth = new Tone.Synth({
                    oscillator: { type: 'sawtooth' },
                    envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.1 }
                }).toDestination();
                laserSynth.volume.value = -12;

                // Explosion noise synthesizer
                explosionSynth = new Tone.NoiseSynth({
                    noise: { type: 'white' },
                    envelope: { attack: 0.005, decay: 0.2, sustain: 0 }
                }).toDestination();
                explosionSynth.volume.value = -10;

                Tone.start();
                audioInitialized = true;
            } catch (e) {
                console.log('Audio init postponed until user interaction.');
            }
        }

        function playLaserSound() {
            if (soundMuted || !audioInitialized) return;
            try {
                laserSynth.triggerAttackRelease("C6", "16n");
            } catch(e){}
        }

        function playExplosionSound() {
            if (soundMuted || !audioInitialized) return;
            try {
                explosionSynth.triggerAttackRelease("8n");
            } catch(e){}
        }

        // --- Game State Variables ---
        let isRunning = false;
        let isPaused = false;
        let score = 0;
        let highScore = localStorage.getItem('space_shooter_hi') || 0;
        let animationFrameId;

        document.getElementById('highScoreDisplay').innerText = String(highScore).padStart(4, '0');

        // --- Input State ---
        const keys = { left: false, right: false, shoot: false };

        // --- Entities ---
        const player = {
            x: canvasWidth / 2,
            y: canvasHeight - 35,
            width: 32,
            height: 24,
            speed: 6,
            color: '#22c55e',
            lastShot: 0,
            shootCooldown: 180 // ms
        };

        let bullets = [];
        let asteroids = [];
        let particles = [];
        let stars = [];

        // Initialize Background Stars
        function initStars() {
            stars = [];
            for (let i = 0; i < 50; i++) {
                stars.push({
                    x: Math.random() * canvasWidth,
                    y: Math.random() * canvasHeight,
                    size: Math.random() * 2 + 0.5,
                    speed: Math.random() * 1.5 + 0.2,
                    opacity: Math.random() * 0.8 + 0.2
                });
            }
        }

        // Spawn Asteroid
        function spawnAsteroid() {
            const size = Math.random() * 20 + 15;
            asteroids.push({
                x: Math.random() * (canvasWidth - size * 2) + size,
                y: -size,
                size: size,
                speed: Math.random() * 2 + 1 + (score / 150), // Scales speed with score
                rotation: 0,
                rotSpeed: (Math.random() - 0.5) * 0.05,
                vertices: generateAsteroidShape(size)
            });
        }

        // Procedural Asteroid Shape Generation
        function generateAsteroidShape(radius) {
            const numPoints = 7;
            const points = [];
            for (let i = 0; i < numPoints; i++) {
                const angle = (i / numPoints) * Math.PI * 2;
                const dist = radius * (0.75 + Math.random() * 0.5);
                points.push({ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist });
            }
            return points;
        }

        // Particle Explosion Effect
        function createExplosion(x, y, color = '#22c55e', count = 12) {
            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 4 + 1;
                particles.push({
                    x: x,
                    y: y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    size: Math.random() * 3 + 1,
                    color: color,
                    life: 1.0,
                    decay: Math.random() * 0.04 + 0.02
                });
            }
        }

        // --- Core Loop Update Function ---
        function update(now) {
            if (!isRunning || isPaused) return;

            // Update Player Position
            if (keys.left && player.x > player.width / 2) {
                player.x -= player.speed;
            }
            if (keys.right && player.x < canvasWidth - player.width / 2) {
                player.x += player.speed;
            }

            // Shooting Logic
            if (keys.shoot && now - player.lastShot > player.shootCooldown) {
                bullets.push({
                    x: player.x,
                    y: player.y - player.height / 2,
                    speed: 9,
                    length: 12
                });
                player.lastShot = now;
                playLaserSound();
            }

            // Update Bullets
            for (let i = bullets.length - 1; i >= 0; i--) {
                bullets[i].y -= bullets[i].speed;
                if (bullets[i].y < -20) {
                    bullets.splice(i, 1);
                }
            }

            // Update Stars
            stars.forEach(star => {
                star.y += star.speed;
                if (star.y > canvasHeight) {
                    star.y = 0;
                    star.x = Math.random() * canvasWidth;
                }
            });

            // Random Asteroid Spawning Rate
            if (Math.random() < 0.035) {
                spawnAsteroid();
            }

            // Update Asteroids & Collisions
            for (let aIndex = asteroids.length - 1; aIndex >= 0; aIndex--) {
                const ast = asteroids[aIndex];
                ast.y += ast.speed;
                ast.rotation += ast.rotSpeed;

                // Check collision with Player
                const distToPlayer = Math.hypot(ast.x - player.x, ast.y - player.y);
                if (distToPlayer < ast.size + player.width / 3) {
                    createExplosion(player.x, player.y, '#f87171', 25);
                    createExplosion(ast.x, ast.y, '#475569', 15);
                    playExplosionSound();
                    gameOver();
                    return;
                }

                // Check collision with Bullets
                for (let bIndex = bullets.length - 1; bIndex >= 0; bIndex--) {
                    const bul = bullets[bIndex];
                    const distToBullet = Math.hypot(ast.x - bul.x, ast.y - bul.y);

                    if (distToBullet < ast.size + 4) {
                        // Collision hit!
                        createExplosion(ast.x, ast.y, '#22c55e', 12);
                        playExplosionSound();

                        // Increment Score
                        score += 10;
                        document.getElementById('scoreDisplay').innerText = String(score).padStart(4, '0');

                        // Remove entities
                        asteroids.splice(aIndex, 1);
                        bullets.splice(bIndex, 1);
                        break;
                    }
                }

                // Remove off-screen asteroids
                if (ast.y > canvasHeight + ast.size) {
                    asteroids.splice(aIndex, 1);
                }
            }

            // Update Particle Effects
            for (let pIndex = particles.length - 1; pIndex >= 0; pIndex--) {
                const p = particles[pIndex];
                p.x += p.vx;
                p.y += p.vy;
                p.life -= p.decay;

                if (p.life <= 0) {
                    particles.splice(pIndex, 1);
                }
            }
        }

        // --- Render Function ---
        function draw() {
            // Clear Screen
            ctx.fillStyle = '#090d16';
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);

            // Draw Stars Background
            stars.forEach(star => {
                ctx.fillStyle = `rgba(226, 232, 240, ${star.opacity})`;
                ctx.fillRect(star.x, star.y, star.size, star.size);
            });

            // Draw Bullets (Glowing Green Beams)
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#22c55e';
            ctx.fillStyle = '#4ade80';
            bullets.forEach(b => {
                ctx.fillRect(b.x - 1.5, b.y, 3, b.length);
            });

            // Draw Player Ship (Vector Style)
            if (isRunning) {
                ctx.save();
                ctx.translate(player.x, player.y);
                ctx.shadowBlur = 12;
                ctx.shadowColor = '#22c55e';
                ctx.strokeStyle = '#22c55e';
                ctx.lineWidth = 2;
                ctx.fillStyle = '#0f172a';

                ctx.beginPath();
                // Spaceship triangle silhouette
                ctx.moveTo(0, -player.height / 2);
                ctx.lineTo(player.width / 2, player.height / 2);
                ctx.lineTo(0, player.height / 4);
                ctx.lineTo(-player.width / 2, player.height / 2);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Thruster Glow
                ctx.fillStyle = Math.random() > 0.5 ? '#22c55e' : '#16a34a';
                ctx.beginPath();
                ctx.moveTo(-player.width / 4, player.height / 2.5);
                ctx.lineTo(0, player.height / 2.5 + (Math.random() * 8 + 4));
                ctx.lineTo(player.width / 4, player.height / 2.5);
                ctx.fill();

                ctx.restore();
            }

            // Draw Asteroids
            ctx.shadowBlur = 4;
            ctx.shadowColor = '#334155';
            asteroids.forEach(ast => {
                ctx.save();
                ctx.translate(ast.x, ast.y);
                ctx.rotate(ast.rotation);

                ctx.strokeStyle = '#64748b';
                ctx.fillStyle = '#0f172a';
                ctx.lineWidth = 1.5;

                ctx.beginPath();
                ast.vertices.forEach((pt, idx) => {
                    if (idx === 0) ctx.moveTo(pt.x, pt.y);
                    else ctx.lineTo(pt.x, pt.y);
                });
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.restore();
            });

            // Draw Particles
            ctx.shadowBlur = 6;
            particles.forEach(p => {
                ctx.shadowColor = p.color;
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.life;
                ctx.fillRect(p.x, p.y, p.size, p.size);
            });
            ctx.globalAlpha = 1.0;
            ctx.shadowBlur = 0; // Reset Shadow
        }

        // --- Main Game Loop ---
        function loop(timestamp) {
            update(timestamp);
            draw();
            animationFrameId = requestAnimationFrame(loop);
        }

        // --- Start & Game Over Handlers ---
        function startGame() {
            initAudio();
            initStars();
            bullets = [];
            asteroids = [];
            particles = [];
            score = 0;
            player.x = canvasWidth / 2;
            document.getElementById('scoreDisplay').innerText = '0000';
            document.getElementById('overlayScreen').classList.add('hidden');
            isRunning = true;
            isPaused = false;
        }

        function gameOver() {
            isRunning = false;
            if (score > highScore) {
                highScore = score;
                localStorage.setItem('space_shooter_hi', highScore);
                document.getElementById('highScoreDisplay').innerText = String(highScore).padStart(4, '0');
            }

            document.getElementById('overlayTitle').innerText = 'SECTOR OVERRUN';
            document.getElementById('overlaySubtitle').innerHTML = `Final Score: <span class="text-emerald-400 font-bold">${score}</span>`;
            document.getElementById('startBtn').innerText = 'TRY AGAIN ';
            document.getElementById('overlayScreen').classList.remove('hidden');
        }

        // --- Input Event Listeners ---
        window.addEventListener('keydown', e => {
            if (['ArrowLeft', 'a', 'A'].includes(e.key)) keys.left = true;
            if (['ArrowRight', 'd', 'D'].includes(e.key)) keys.right = true;
            if (['Space', ' ', 'ArrowUp', 'w', 'W'].includes(e.key)) {
                keys.shoot = true;
                e.preventDefault();
            }
        });

        window.addEventListener('keyup', e => {
            if (['ArrowLeft', 'a', 'A'].includes(e.key)) keys.left = false;
            if (['ArrowRight', 'd', 'D'].includes(e.key)) keys.right = false;
            if (['Space', ' ', 'ArrowUp', 'w', 'W'].includes(e.key)) keys.shoot = false;
        });

        // Touch Control Handlers for Mobile
        const touchLeft = document.getElementById('touchLeft');
        const touchRight = document.getElementById('touchRight');
        const touchShoot = document.getElementById('touchShoot');

        const bindTouch = (elem, key) => {
            elem.addEventListener('touchstart', (e) => { e.preventDefault(); keys[key] = true; initAudio(); });
            elem.addEventListener('touchend', (e) => { e.preventDefault(); keys[key] = false; });
        };

        bindTouch(touchLeft, 'left');
        bindTouch(touchRight, 'right');
        bindTouch(touchShoot, 'shoot');

        // Direct Touch Drag on Canvas
        canvas.addEventListener('touchmove', (e) => {
            if (!isRunning) return;
            const rect = canvas.getBoundingClientRect();
            const touchX = e.touches[0].clientX - rect.left;
            player.x = touchX;
            keys.shoot = true; // Auto shoot on drag
        });
        canvas.addEventListener('touchend', () => { keys.shoot = false; });

        // Button Listeners
        document.getElementById('startBtn').addEventListener('click', startGame);

        document.getElementById('pauseBtn').addEventListener('click', () => {
            if (!isRunning) return;
            isPaused = !isPaused;
            document.getElementById('pauseBtn').innerText = isPaused ? '▶ PLAY' : '⏸ PAUSE';
        });

        document.getElementById('restartBtn').addEventListener('click', () => {
            startGame();
        });

        document.getElementById('soundBtn').addEventListener('click', () => {
            initAudio();
            soundMuted = !soundMuted;
            document.getElementById('soundIcon').innerText = soundMuted ? '🔇' : '🔊';
        });

        // Initialize stars & start render loop
        initStars();
        requestAnimationFrame(loop);
    </script>
</body>
</html>