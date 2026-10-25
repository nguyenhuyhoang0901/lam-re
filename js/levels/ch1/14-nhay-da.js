(function(){
'use strict';
const LR = window.LR;

// Định nghĩa ải Nhảy Đá
const mod = {
    title: "Căn Lực Nhảy Đá",
    desc: "Giữ Space hoặc chạm giữ màn hình để tích lực nhảy qua các hòn đá bồng bềnh.",
    rules: [
        "Chạm giữ màn hình hoặc phím Space để tích lực nhảy.",
        "Nhả ra để nhảy sang hòn đá tiếp theo.",
        "Hạ cánh chuẩn tâm hoặc bấu mép thành công để nhận điểm combo cao."
    ],
    pad: false, // Không dùng d-pad ảo vì dùng cơ chế giữ màn hình
    actLabel: "NHẢY",

    // Khởi tạo trạng thái khi vào ải
    enter(opt) {
        this.initGame();
    },

    exit() {
        if (this.chargeOsc) {
            try { this.chargeOsc.stop(); this.chargeOsc.disconnect(); } catch(e){}
            this.chargeOsc = null;
        }
    },

    initGame() {
        this.PHYSICS = {
            gravity: 1180,
            minJumpDist: 85,
            maxJumpDist: 480,
            maxChargeTime: 0.92,
            jumpFlightTime: 0.62,
            sweetSpotRadius: 9,
            edgeSnapTolerance: 13
        };

        this.gameState = {
            score: 0,
            combo: 1,
            baseStoneWidth: 90,
            cameraX: 0,
            targetCameraX: 0,
            time: 0,
            edgeSnapEnabled: true
        };

        this.player = {
            x: 115, y: 0, vx: 0, vy: 0,
            state: 'IDLE',
            chargeTime: 0,
            chargeDir: 1,
            scaleX: 1, scaleY: 1,
            rotation: 0,
            climbProgress: 0,
            climbStartX: 0, climbTargetX: 0
        };

        this.stones = [];
        this.particles = [];
        this.floatingTexts = [];
        this.clouds = [];
        this.initClouds();

        const firstStone = this.createStone(115, this.gameState.baseStoneWidth, true);
        this.stones.push(firstStone);
        this.spawnNextStone();
        this.placePlayerOnStone(this.stones[0]);
    },

    initClouds() {
        for (let i = 0; i < 8; i++) {
            this.clouds.push({
                x: Math.random() * 1200,
                y: 30 + Math.random() * 200,
                w: 70 + Math.random() * 80,
                speed: 6 + Math.random() * 12,
                alpha: 0.08 + Math.random() * 0.12
            });
        }
    },

    getBaseGroundY() {
        const h = LR.G.H;
        const minY = 70;
        const maxY = Math.max(minY, h - 60);
        return Math.max(minY, Math.min(maxY, h * 0.68));
    },

    createStone(x, width, isFirst = false) {
        const baseY = this.getBaseGroundY();
        const yOffset = isFirst ? 0 : (Math.random() * 70 - 35);
        return {
            x, baseY: baseY + yOffset, y: baseY + yOffset, yOffset,
            w: width, h: 48 + Math.random() * 24,
            bobPhase: Math.random() * Math.PI * 2,
            depressY: 0,
            crystalCollected: false
        };
    },

    placePlayerOnStone(stone) {
        this.player.x = stone.x;
        this.player.y = stone.y;
        this.player.vx = 0; this.player.vy = 0;
        this.player.state = 'IDLE';
        this.player.chargeTime = 0;
        this.player.scaleX = 1; this.player.scaleY = 1;
        this.player.rotation = 0;
    },

    spawnNextStone() {
        const lastStone = this.stones[this.stones.length - 1];
        const dist = 170 + Math.random() * 275;
        const newWidth = 46 + Math.random() * 58;
        this.stones.push(this.createStone(lastStone.x + dist, newWidth, false));
        if (this.stones.length > 5) this.stones.shift();
    },

    getChargeRatio() {
        return Math.min(1, Math.max(0, this.player.chargeTime / this.PHYSICS.maxChargeTime));
    },

    calculateJumpVelocities(chargeRatio) {
        const targetDist = this.PHYSICS.minJumpDist + chargeRatio * (this.PHYSICS.maxJumpDist - this.PHYSICS.minJumpDist);
        const nextStone = this.stones[1];
        const flightTime = 0.42 + chargeRatio * 0.36;
        const vx = targetDist / flightTime;
        const deltaY = nextStone ? (nextStone.baseY - this.player.y) : 0;
        const vy = (deltaY - 0.5 * this.PHYSICS.gravity * flightTime * flightTime) / flightTime;
        return { vx, vy, targetDist, flightTime };
    },

    startCharging() {
        if (this.player.state !== 'IDLE') return;
        this.player.state = 'CHARGING';
        this.player.chargeTime = 0;
        this.player.chargeDir = 1;
    },

    releaseJump() {
        if (this.player.state !== 'CHARGING') return;
        const ratio = this.getChargeRatio();
        const { vx, vy } = this.calculateJumpVelocities(ratio);
        this.player.vx = vx;
        this.player.vy = vy;
        this.player.state = 'JUMPING';
        this.player.scaleX = 0.78;
        this.player.scaleY = 1.28;
        if (this.stones[0]) this.stones[0].depressY = 0;
        this.spawnParticles(this.player.x, this.player.y, '#38bdf8', 12, 120);
        LR.Sound.sfx.swing();
    },

    // Xử lý sự kiện điều khiển
    pointerDown(x, y) {
        this.startCharging();
    },

    pointerUp(x, y) {
        if (this.player.state === 'CHARGING') this.releaseJump();
    },

    keyDown(code) {
        if (code === 'Space') {
            if (this.player.state === 'IDLE') {
                this.startCharging();
            }
        }
    },

    // Lưu ý: Cần thêm xử lý keyup nếu muốn dùng phím Space hoàn chỉnh, hoặc tận dụng engine hiện tại.
    // Vòng lặp update
    update(dt) {
        this.gameState.time += dt;
        const canvas = LR.G.cv;

        this.clouds.forEach(c => {
            c.x -= c.speed * dt;
            if (c.x + c.w < 0) c.x = canvas.width / LR.G.dpr + 60;
        });

        this.gameState.cameraX += (this.gameState.targetCameraX - this.gameState.cameraX) * Math.min(1, dt * 7.5);

        this.stones.forEach((s, idx) => {
            if (idx === 0 && (this.player.state === 'IDLE' || this.player.state === 'CHARGING')) {
                s.y = s.baseY + s.depressY;
            } else {
                s.y = s.baseY + Math.sin(this.gameState.time * 2.2 + s.bobPhase) * 3.5;
            }
        });

        if (this.player.state === 'IDLE') {
            this.player.y = this.stones[0].y;
            this.player.scaleX += (1 - this.player.scaleX) * Math.min(1, dt * 14);
            this.player.scaleY += (1 - this.player.scaleY) * Math.min(1, dt * 14);
        } else if (this.player.state === 'CHARGING') {
            this.player.chargeTime += dt * this.player.chargeDir;
            if (this.player.chargeTime >= this.PHYSICS.maxChargeTime) {
                this.player.chargeTime = this.PHYSICS.maxChargeTime;
                this.player.chargeDir = -1;
            } else if (this.player.chargeTime <= 0.05 && this.player.chargeDir === -1) {
                this.player.chargeTime = 0.05;
                this.player.chargeDir = 1;
            }
            const ratio = this.getChargeRatio();
            this.player.scaleY = 1 - ratio * 0.36;
            this.player.scaleX = 1 + ratio * 0.28;
            this.stones[0].depressY = ratio * 9;
            this.player.y = this.stones[0].y;
        } else if (this.player.state === 'JUMPING') {
            const prevY = this.player.y;
            this.player.x += this.player.vx * dt;
            this.player.y += this.player.vy * dt;
            this.player.vy += this.PHYSICS.gravity * dt;
            this.player.scaleX += (1 - this.player.scaleX) * Math.min(1, dt * 8);
            this.player.scaleY += (1 - this.player.scaleY) * Math.min(1, dt * 8);
            if (this.player.vy > 0) this.checkLanding(prevY);
        } else if (this.player.state === 'CLIMBING') {
            this.player.climbProgress += dt * 4.2;
            if (this.player.climbProgress >= 1) {
                this.player.x = this.player.climbTargetX;
                this.completeSuccessfulJump(this.stones[1], false, true);
            } else {
                this.player.x = this.player.climbStartX + (this.player.climbTargetX - this.player.climbStartX) * this.player.climbProgress;
                this.player.y = this.stones[1].y + Math.sin((1 - this.player.climbProgress) * Math.PI) * 8;
            }
        } else if (this.player.state === 'FALLING') {
            this.player.x += this.player.vx * dt;
            this.player.y += this.player.vy * dt;
            this.player.vy += this.PHYSICS.gravity * dt;
            this.player.rotation += 5 * dt;
            if (this.player.y > (canvas.height / LR.G.dpr) + 120) {
                LR.G.finish({ win: false, title: "Rơi xuống vực!", msg: "Bạn nhảy hụt khỏi khối đá.", score: this.gameState.score });
            }
        }

        // Cập nhật HUD của game chính
        LR.G.hud.set([
            { l: 'Điểm', v: this.gameState.score },
            { l: 'Combo', v: 'x' + this.gameState.combo }
        ]);
    },

    checkLanding(prevY) {
        for (let i = 1; i >= 0; i--) {
            const stone = this.stones[i];
            if (!stone) continue;
            const halfW = stone.w / 2;
            const leftEdge = stone.x - halfW;
            const rightEdge = stone.x + halfW;

            if (prevY <= stone.y + 8 && this.player.y >= stone.y - 4) {
                if (this.player.x >= leftEdge && this.player.x <= rightEdge) {
                    this.player.y = stone.y;
                    this.player.vx = 0; this.player.vy = 0;
                    if (i === 0) {
                        this.player.state = 'IDLE';
                        this.spawnFloatingText(this.player.x, this.player.y - 45, "CHƯA QUA ĐÁ!", "#94a3b8");
                    } else {
                        const distFromCenter = Math.abs(this.player.x - stone.x);
                        const isSweet = distFromCenter <= this.PHYSICS.sweetSpotRadius;
                        this.completeSuccessfulJump(stone, isSweet, false);
                    }
                    return;
                }

                if (i === 1 && this.gameState.edgeSnapEnabled) {
                    const snapTol = this.PHYSICS.edgeSnapTolerance;
                    const nearLeft = this.player.x >= leftEdge - snapTol && this.player.x < leftEdge;
                    const nearRight = this.player.x > rightEdge && this.player.x <= rightEdge + snapTol;

                    if (nearLeft || nearRight) {
                        this.player.state = 'CLIMBING';
                        this.player.vx = 0; this.player.vy = 0;
                        this.player.climbProgress = 0;
                        this.player.climbStartX = this.player.x;
                        this.player.climbTargetX = nearLeft ? (leftEdge + 10) : (rightEdge - 10);
                        this.spawnFloatingText(this.player.x, this.player.y - 50, "BẤU MÉP! 😅", "#38bdf8");
                        return;
                    }
                }
            }
        }

        const targetStone = this.stones[1];
        if (targetStone && this.player.y > targetStone.y + 38) {
            this.player.state = 'FALLING';
            LR.Sound.sfx.hurtBig();
        }
    },

    completeSuccessfulJump(targetStone, isSweetSpot) {
        this.player.y = targetStone.y;
        this.player.state = 'IDLE';

        if (isSweetSpot) {
            const pointsEarned = 2 * this.gameState.combo;
            this.gameState.score += pointsEarned;
            this.spawnFloatingText(this.player.x, this.player.y - 55, `HOÀN HẢO! +${pointsEarned}`, "#fbbf24");
            this.gameState.combo++;
            targetStone.crystalCollected = true;
            LR.Sound.sfx.win();
        } else {
            this.gameState.score += 1;
            this.gameState.combo = 1;
            this.spawnFloatingText(this.player.x, this.player.y - 45, "+1", "#e2e8f0");
            LR.Sound.sfx.catchOk();
        }

        this.stones.shift();
        this.spawnNextStone();
        this.gameState.targetCameraX = this.stones[0].x - 115;

        // Điều kiện chiến thắng (Ví dụ đạt 10 điểm thì thắng)
        if (this.gameState.score >= 10) {
            LR.G.finish({
                win: true,
                stars: 3,
                title: "Vượt Ải Thành Công!",
                msg: "Bạn đã căn lực nhảy đá cực kỳ chuẩn xác để làm hài lòng nhà vợ.",
                score: this.gameState.score,
                rows: [["Điểm số", this.gameState.score]]
            });
        }
    },

    spawnParticles(x, y, color, count, speed) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = 25 + Math.random() * speed;
            this.particles.push({
                x, y: y - 4,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd - 40,
                radius: 2 + Math.random() * 3,
                color, alpha: 1,
                life: 0.4 + Math.random() * 0.25
            });
        }
    },

    spawnFloatingText(x, y, text, color) {
        this.floatingTexts.push({ x, y, text, color, life: 1.1 });
    },

    // Vẽ giao diện game lên canvas
    draw() {
        const ctx = LR.G.ctx;
        const canvas = LR.G.cv;
        const w = canvas.width / LR.G.dpr;
        const h = canvas.height / LR.G.dpr;

        ctx.clearRect(0, 0, w, h);

        // Vẽ nền trời
        const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
        skyGrad.addColorStop(0, '#090d16');
        skyGrad.addColorStop(0.6, '#1e293b');
        skyGrad.addColorStop(1, '#0f172a');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, h);

        // Vẽ mây
        this.clouds.forEach(c => {
            ctx.fillStyle = `rgba(148, 163, 184, ${c.alpha})`;
            ctx.beginPath();
            ctx.roundRect(c.x, c.y, c.w, 22, 11);
            ctx.fill();
        });

        ctx.save();
        ctx.translate(-this.gameState.cameraX, 0);

        // Vẽ đá
        this.stones.forEach((stone, index) => {
            const sx = stone.x - stone.w / 2;
            const sy = stone.y;
            ctx.fillStyle = '#334155';
            ctx.fillRect(sx, sy, stone.w, stone.h);
            ctx.fillStyle = '#38bdf8';
            ctx.fillRect(sx, sy, stone.w, 8);
        });

        // Vẽ nhân vật
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.roundRect(this.player.x - 23, this.player.y - 52, 46, 52, 12);
        ctx.fill();

        // Vẽ hiệu ứng chữ bay
        this.floatingTexts.forEach(ft => {
            ctx.save();
            ctx.font = '800 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = ft.color;
            ctx.fillText(ft.text, ft.x, ft.y);
            ctx.restore();
        });

        ctx.restore();
    },

    resize() {}
};

// Đăng ký module vào hệ thống cấp độ của game
LR.chapters.forEach(ch => {
    if (ch.id === 'ch1') { // Thêm vào Chương 1 hoặc chương bạn muốn
        ch.levels.push({
            id: 'nhay-da',
            title: 'Căn Lực Nhảy Đá',
            desc: 'Chinh phục thử thách nhảy đá vượt vực.',
            status: 'ready',
            rules: mod.rules,
            mod: mod
        });
    }
});

})();
