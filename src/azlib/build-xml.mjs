import {isPlainObject} from './helpers.mjs'
/*
	варинаты
		[tag, {attrs}, [children] ]
		[tag, {attrs}, text ]
		[tag, [children] ]
		[tag, {attrs} ]
		[tag, text ]
		[tag]
		text
*/

function ItemAsXML(decl, target) {
	const doc = target.ownerDocument 
	if(Array.isArray(decl)) {
		const [tag, maybeAttrs, children] = decl;
		const el = doc.createElement(tag)
		target.appendChild(el)
		if(children !== undefined) {
			// [tag, {attrs}, [children] ]
			// [tag, {attrs}, text ]
			for(const a in maybeAttrs) {
				el.setAttribute(a, maybeAttrs[a])
			}
			if(Array.isArray(children)) {
				for(const a of children)
					ItemAsXML(a, el)
			} else {
				el.appendChild(doc.createTextNode(children))
			}
		} else if(maybeAttrs !== undefined) {
			//[tag, [children] ]
			//[tag, {attrs} ]
			//[tag, text ]
			if(Array.isArray(maybeAttrs)) {
				//[tag, [children] ]
				for(const a of maybeAttrs)
					ItemAsXML(a, el)
			} else if(isPlainObject(maybeAttrs)) {
				//[tag, {attrs} ]
				for(const a in maybeAttrs) {
					el.setAttribute(a, maybeAttrs[a])
				}				
			} else {
				//[tag, text ]
				el.appendChild(doc.createTextNode(maybeAttrs))
			}
		} else {
			// [tag]
			// empty tag
		}
	} else {
		// text
		target.appendChild(doc.createTextNode(decl))
	}
}

export default function asXML(root,children,root_attrs) {
	let xmlDoc = document
            .implementation
            .createDocument(null, root);

	for(const a in root_attrs) {
		xmlDoc.documentElement.setAttribute(a, root_attrs[a])
	}
	if(Array.isArray(children)){
		for(const c of children)
			ItemAsXML(c, xmlDoc.documentElement)
	} else if(children !== null) {
		xmlDoc.documentElement.appendChild(xmlDoc.createTextNode(children))
	}
	return new XMLSerializer()
            .serializeToString(xmlDoc)
}