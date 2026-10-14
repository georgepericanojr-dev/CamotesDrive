/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ocean: "#164E43",
        mint: "#EAF2EC",
        sand: "#F7F8F4",
        ink: "#1B302A",
        muted: "#77817A",
        coral: "#EAA878",
      },
    },
  },
  plugins: [],
};
