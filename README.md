# 🦑 Squid Arcade

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-black?style=for-the-badge&logo=next.js&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-black?style=for-the-badge&logo=three.js&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

> **UNEXPECTED EXPERIENCE!!!!!!!!** > A cinematic, browser-based 3D arcade bringing the intense, high-stakes games of Squid Game to the web.

🔗 **[Play the Live Demo on Vercel](https://squid-arcade.vercel.app)**

---

## 🎮 The Games

Squid Arcade features a custom-built 3D web engine designed to test your patience, precision, and survival instincts:

* **🚦 Red Light, Green Light:** A high-tension movement and timing challenge. Stop on a dime or face elimination.
* **🍪 Dalgona Candy:** Featuring a custom pressure-sensitive physics system. Carve out the shape perfectly without breaking the fragile candy.
* **🌉 Glass Bridge:** Test your memory and luck. One wrong step means a long drop. 

## ⚙️ Tech Stack

* **Framework:** Next.js
* **Language:** TypeScript
* **Graphics/Engine:** Three.js (Migrated from 2D Canvas to a full 3D rendering engine)
* **Styling:** CSS / Tailwind
* **Deployment:** Vercel

## 🚀 Getting Started

Follow these steps to run Squid Arcade locally on your machine.

### Prerequisites
* Node.js (v18 or higher recommended)
* npm, yarn, or pnpm

### 1. Clone the Repository
```bash
git clone [https://github.com/Mohit25f101/squid-arcade.git](https://github.com/Mohit25f101/squid-arcade.git)
cd squid-arcade
Here is a complete, professional README.md tailored specifically for your Squid Arcade repository. It incorporates standard best practices, highlights your specific tech stack (Next.js, TypeScript, Three.js), and outlines the exact games you've built.

You can click the Copy button in the top right corner of the block below and paste it directly into your README.md file!

Markdown
# 🦑 Squid Arcade

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-black?style=for-the-badge&logo=next.js&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-black?style=for-the-badge&logo=three.js&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

> **UNEXPECTED EXPERIENCE!!!!!!!!** > A cinematic, browser-based 3D arcade bringing the intense, high-stakes games of Squid Game to the web.

🔗 **[Play the Live Demo on Vercel](https://squid-arcade.vercel.app)**

---

## 🎮 The Games

Squid Arcade features a custom-built 3D web engine designed to test your patience, precision, and survival instincts:

* **🚦 Red Light, Green Light:** A high-tension movement and timing challenge. Stop on a dime or face elimination.
* **🍪 Dalgona Candy:** Featuring a custom pressure-sensitive physics system. Carve out the shape perfectly without breaking the fragile candy.
* **🌉 Glass Bridge:** Test your memory and luck. One wrong step means a long drop. 

## ⚙️ Tech Stack

* **Framework:** Next.js
* **Language:** TypeScript
* **Graphics/Engine:** Three.js (Migrated from 2D Canvas to a full 3D rendering engine)
* **Styling:** CSS / Tailwind
* **Deployment:** Vercel

## 🚀 Getting Started

Follow these steps to run Squid Arcade locally on your machine.

### Prerequisites
* Node.js (v18 or higher recommended)
* npm, yarn, or pnpm

### 1. Clone the Repository
```bash
git clone [https://github.com/Mohit25f101/squid-arcade.git](https://github.com/Mohit25f101/squid-arcade.git)
cd squid-arcade
2. Install Dependencies
Bash
npm install
# or
yarn install
3. Start the Development Server
Bash
npm run dev
# or
yarn dev
Open http://localhost:3000 in your browser to start playing.
📂 Project Structure
Plaintext
squid-arcade/
├── public/               # Static assets, 3D models, and audio files
├── src/                  # Core application and game engine code
│   ├── components/       # Reusable UI components
│   ├── game/             # Three.js logic, physics, and game states
│   └── styles/           # CSS and styling
├── .vercel/              # Vercel deployment configuration
├── next.config.ts        # Next.js configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Project dependencies and scripts
🐛 Known Issues & Audio Management
Audio Engine: An intensive audio phase manager runs in the background. If you experience audio lag on certain mobile browsers, ensure hardware acceleration is enabled. (See verify_music_bug.ts and test-music-manager.js for testing scripts).

🤝 Contributing
Contributions, issues, and feature requests are welcome!

Fork the project.

Create your feature branch (git checkout -b feature/AmazingFeature).

Commit your changes (git commit -m 'Add some AmazingFeature').

Push to the branch (git push origin feature/AmazingFeature).

Open a Pull Request.

👨‍💻 Author
Built by Mohit Kumar (Mohit25f101)
