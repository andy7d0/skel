import round from 'locutus/php/math/round.js'
import {produce} from 'immer';

Function.isFunction = obj => typeof obj === "function"

/*
  "str".decode(name)
*/

// eslint-disable-next-line no-extend-native
Object.defineProperty(String.prototype, 'decode', {
    enumerable: false,
    value: function (decoder) { return Function.isFunction(decoder)? decoder(this.toString()) : decoder[this]; }
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


Object.produce = produce

//https://github.com/GoogleChromeLabs/jsbi

//strtotime
//date