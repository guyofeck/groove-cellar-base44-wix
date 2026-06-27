import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { CartProvider } from "@/lib/cart";
import Layout from "@/components/Layout";
import Shop from "@/pages/Shop";
import RecordDetail from "@/pages/RecordDetail";
import Cart from "@/pages/Cart";
import CheckoutReturn from "@/pages/CheckoutReturn";
import Account from "@/pages/Account";
import Auth from "@/pages/Auth";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <Routes>
            <Route path="/login" element={<Auth />} />
            <Route element={<Layout />}>
              <Route path="/" element={<Shop />} />
              <Route path="/records/:id" element={<RecordDetail />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout/return" element={<CheckoutReturn />} />
              <Route path="/account" element={<Account />} />
            </Route>
          </Routes>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
