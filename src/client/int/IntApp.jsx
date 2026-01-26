import { Routes, Route} from "react-router-dom"
 
export default function IntAppRoutes(){
  return <Routes>
    <Route path="int_app" element={<IntApp/>} />
  </Routes>
}

function IntApp() {
    return <div>
        <h1>int app</h1>
    </div>
}

