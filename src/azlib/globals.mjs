import round from 'locutus/php/math/round.js'


/*
  "str".decode(name)
*/

// eslint-disable-next-line no-extend-native
Object.defineProperty(String.prototype, 'decode', {
    enumerable: false,
    value: function (decoder) { return typeof decoder === "function"? decoder(this.toString()) : decoder[this]; }
});


// eslint-disable-next-line no-extend-native
Object.defineProperty(String.prototype, 'initialLetter', {
    enumerable: false,
    get: function () { return this.length ? `${this[0].toUpperCase()}.` : ''; }
});

// eslint-disable-next-line no-extend-native
Object.defineProperty(String.prototype, 'in', {
    enumerable: false,
    value: function (...values) { return values.includes(this.toString()); }
});


Math.phpRound = (v,n) => round(v,n)


//https://github.com/GoogleChromeLabs/jsbi

//strtotime
//date