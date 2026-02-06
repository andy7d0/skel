import {Form,FullField,Ctrl, globalShowModal, AutoActions} from 'azlib/components/form'
//import {alert} from 'azlib/components/controls'
import {BEGIN_SCHEMA, CMODE} from 'azlib/schema-checker'
import * as CSM from 'azlib/schema-checker'

const TEST_SCM = BEGIN_SCHEMA
	.SATATES({initial:{}})
	.ACTIONS({submit:{
		goal: 'submited'
		, label: 'OK'
		, access: true
		}
	})
	.MODEL({
		test:CSM.object({access:CMODE.W}) ({
				subfield: CSM.int({access: {initial: CMODE.W, submited: CMODE.R}
					, max: 10
				})
			})
	})
	.END_SCHEMA();

export async function mtest(){
	//await alert(111)
	return await globalShowModal(<Form
		schema={TEST_SCM}
	>
		<FullField name="test.subfield" as={Ctrl.Int} label='test!'/>

		<AutoActions />
		
	</Form>, {closeBy:"closerequest"})
}