/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ['./App.{js,jsx,ts,tsx}', './app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
	theme: {
		extend: {
			colors: {
				teal: {
					DEFAULT: '#14b8a6',
					50: '#f0fdfa',
					100: '#ccfbf1',
					200: '#99f6e4',
					300: '#5eead4',
					400: '#2dd4bf',
					500: '#14b8a6',
					600: '#0d9488',
					700: '#0f766e',
					800: '#115e59',
					900: '#134e4a',
				},
				cyan: {
					DEFAULT: '#06b6d4',
				},
				aqua: '#22d3ee',
			},
		},
	},
	plugins: [],
};


