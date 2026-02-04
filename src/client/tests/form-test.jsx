import {Form,FullField,Ctrl, globalShowModal} from 'azlib/components/form'
//import {alert} from 'azlib/components/controls'

export async function mtest(){
	//await alert(111)
	return await globalShowModal(<Form>aaa<Ctrl.Str/></Form>, {closeBy:"closerequest"})
}