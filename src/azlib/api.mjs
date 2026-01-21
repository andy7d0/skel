
export const API = {
	URL: function(strings, item) {
		return `${strings[0].replace(/[.][^.]+$/,'')}~${item}`;
	}
}