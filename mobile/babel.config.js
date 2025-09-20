module.exports = function (api) {
	api.cache(true);
	return {
		presets: ['babel-preset-expo'],
		// IMPORTANT: Reanimated v3+ moved its plugin to react-native-worklets; keep it LAST
		// Temporarily disable NativeWind babel on web to fix ".plugins is not a valid Plugin property" bundling error
		plugins: ['react-native-worklets/plugin'],
	};
};


