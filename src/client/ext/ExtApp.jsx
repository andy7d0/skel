import { Routes, Route} from "react-router-dom"

export default function ExtAppRoutes(){
  return <Routes>
  	<Route path="ext_app" element={<ExtApp/>} />
  </Routes>
}

function ExtApp() {
	return <div>
		<h1>ext app</h1>
	</div>
}

