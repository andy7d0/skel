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

window.customElements.define("aligned-button", class extends HTMLElement {
    static formAssociated = true;
    static observedAttributes = ['value', 'type', 'align', 'vertical-align'];

    constructor()  {
        super();
        this.internals = this.attachInternals();
        const shadow = this.attachShadow({ mode: "closed", delegatesFocus: true, cloneable: true  });
        const va = this.getAttribute('vertical-align') || 'center'; 
        const ha = this.getAttribute('align') || 'center';
        shadow.innerHTML = `<button style="
                        display: inline-flex;
                        width: 100%;
                        justify-content: ${ha};
                        align-content: ${va};
                    "><span><slot/></span></button>`
        this.input = shadow.querySelector('button');
    }
    get form() { return this.internals.form; }
    get type() { return this.input.type; }
    set type(t) { this.input.type = t; }
    get name() { return this.getAttribute('name'); }
    set name(n) { this.setAttribute('name',n); this.input.name = n; }
    get value() { return this.getAttribute('value'); }
    set value(v) { this.setAttribute('value',v); this.internals.setFormValue(v); this.input.value = v;}

    attributeChangedCallback(name, oldValue, newValue) {
        switch (name) {
        case  'value':  this.internals.setFormValue(newValue);
                        this.input.value = newValue;
                        break;
        case 'align': this.input.style.justifyContent = newValue || 'center'; break;
        case 'vertical-align': this.input.style.alignContent = newValue || 'center'; break;
        }
    }

})

window.customElements.define("input-ext", class extends HTMLElement {
    static formAssociated = true;
    static observedAttributes = ['value','reserved'];

    constructor() {
        super();
        this.internals = this.attachInternals();
        const shadow = this.attachShadow({ mode: "closed", delegatesFocus: true, cloneable: true });
        shadow.innerHTML = `<div style="display:inline-block; position: relative">
                <input
                    style="padding-right: 2em"
                ><div style="display:inline-block; position:absolute; right:0"><slot name="buttons"></slot></div>
                <div><slot></slot></div>
            </div>`
        this.input = shadow.querySelector('input');
        this.input.addEventListener('input', this._onInput.bind(this))
    }
    _onInput(event) {
        const value = event.target.value;
        // Set the value to be submitted with the form
        this.internals.setFormValue(value);
        // Update validation status (e.g., must have at least 2 characters)
        //this.updateValidity(value);
    }
    get form() { return this.internals.form; }
    get value() { return this.input.value; }
    set value(v) { this.input.value = v; }
    get name() { return this.getAttribute('name'); }
    set name(n) { this.setAttribute('name',n); }
    get type() { return this.localName; }
    get validity() { return this.internals.validity; }
    get validationMessage() { return this.internals.validationMessage; }
    get willValidate() {return this.internals.willValidate; }
    checkValidity() { return this.internals.checkValidity(); }
    reportValidity() { return this.internals.reportValidity(); }

    focus() { this.input.focus() }

    attributeChangedCallback(name, oldValue, newValue) {
        switch (name) {
          case 'value': this.internals.setFormValue(newValue); break;
          case 'reserved': this.input.style.paddingRight = newValue;
        }
    }
})