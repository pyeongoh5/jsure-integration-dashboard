import { Routes, Route } from "react-router-dom";
import { Home } from "./pages/Home";

export function App() {
  return (
    <div className="app">
      <header>
        <h1>JSure</h1>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </main>
    </div>
  );
}
