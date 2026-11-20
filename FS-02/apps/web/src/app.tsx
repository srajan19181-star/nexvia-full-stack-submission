import { lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { StoreLayout } from "./components/storefront";
import { Loading } from "./components/ui";

const Home=lazy(()=>import("./pages/home"));
const Catalog=lazy(()=>import("./pages/catalog"));
const ProductDetail=lazy(()=>import("./pages/product-detail"));
const Login=lazy(()=>import("./pages/auth-pages").then(module=>({default:module.Login})));
const Register=lazy(()=>import("./pages/auth-pages").then(module=>({default:module.Register})));
const ForgotPassword=lazy(()=>import("./pages/auth-pages").then(module=>({default:module.ForgotPassword})));
const ResetPassword=lazy(()=>import("./pages/auth-pages").then(module=>({default:module.ResetPassword})));
const VerifyEmail=lazy(()=>import("./pages/auth-pages").then(module=>({default:module.VerifyEmail})));
const Account=lazy(()=>import("./pages/customer").then(module=>({default:module.Account})));
const Addresses=lazy(()=>import("./pages/customer").then(module=>({default:module.Addresses})));
const CartPage=lazy(()=>import("./pages/customer").then(module=>({default:module.CartPage})));
const Checkout=lazy(()=>import("./pages/customer").then(module=>({default:module.Checkout})));
const Orders=lazy(()=>import("./pages/customer").then(module=>({default:module.Orders})));
const OrderDetail=lazy(()=>import("./pages/customer-operations").then(module=>({default:module.OrderDetail})));
const Notifications=lazy(()=>import("./pages/customer-operations").then(module=>({default:module.Notifications})));
const Support=lazy(()=>import("./pages/customer-operations").then(module=>({default:module.Support})));
const Returns=lazy(()=>import("./pages/customer-operations").then(module=>({default:module.Returns})));
const Wishlist=lazy(()=>import("./pages/customer-operations").then(module=>({default:module.Wishlist})));
const AccountSettings=lazy(()=>import("./pages/customer-settings").then(module=>({default:module.AccountSettings})));
const PaymentStatus=lazy(()=>import("./pages/customer-settings").then(module=>({default:module.PaymentStatus})));
const DashboardShell=lazy(()=>import("./pages/portals").then(module=>({default:module.DashboardShell})));
const VendorDashboard=lazy(()=>import("./pages/portals").then(module=>({default:module.VendorDashboard})));
const VendorOnboarding=lazy(()=>import("./pages/vendor-onboarding"));
const VendorProducts=lazy(()=>import("./pages/vendor-operations").then(module=>({default:module.VendorProductsAdvanced})));
const VendorProductEditor=lazy(()=>import("./pages/vendor-product-editor"));
const VendorOrders=lazy(()=>import("./pages/portals").then(module=>({default:module.VendorOrders})));
const VendorAnalytics=lazy(()=>import("./pages/vendor-operations").then(module=>({default:module.VendorAnalytics})));
const VendorCoupons=lazy(()=>import("./pages/vendor-operations").then(module=>({default:module.VendorCoupons})));
const VendorPayouts=lazy(()=>import("./pages/vendor-operations").then(module=>({default:module.VendorPayouts})));
const VendorSettings=lazy(()=>import("./pages/vendor-operations").then(module=>({default:module.VendorSettings})));
const VendorReturns=lazy(()=>import("./pages/vendor-operations").then(module=>({default:module.VendorReturns})));
const VendorReviews=lazy(()=>import("./pages/portal-extras").then(module=>({default:module.VendorReviews})));
const VendorCommissions=lazy(()=>import("./pages/portal-extras").then(module=>({default:module.VendorCommissions})));
const VendorNotifications=lazy(()=>import("./pages/portal-extras").then(module=>({default:module.VendorNotifications})));
const VendorSupport=lazy(()=>import("./pages/portal-extras").then(module=>({default:module.VendorSupport})));
const AdminOverview=lazy(()=>import("./pages/portals").then(module=>({default:module.AdminOverview})));
const AdminVendors=lazy(()=>import("./pages/portals").then(module=>({default:module.AdminVendors})));
const AdminProducts=lazy(()=>import("./pages/portals").then(module=>({default:module.AdminProducts})));
const AdminOrders=lazy(()=>import("./pages/admin-operations").then(module=>({default:module.AdminOrders})));
const AdminCategories=lazy(()=>import("./pages/admin-operations").then(module=>({default:module.AdminCategories})));
const AdminReturns=lazy(()=>import("./pages/admin-operations").then(module=>({default:module.AdminReturns})));
const AdminReviews=lazy(()=>import("./pages/admin-operations").then(module=>({default:module.AdminReviews})));
const AdminSupport=lazy(()=>import("./pages/admin-operations").then(module=>({default:module.AdminSupport})));
const AdminPayouts=lazy(()=>import("./pages/admin-operations").then(module=>({default:module.AdminPayouts})));
const AdminAudit=lazy(()=>import("./pages/admin-operations").then(module=>({default:module.AdminAudit})));
const AdminSettings=lazy(()=>import("./pages/admin-operations").then(module=>({default:module.AdminSettings})));
const AdminCustomers=lazy(()=>import("./pages/portal-extras").then(module=>({default:module.AdminCustomers})));
const AdminAnalytics=lazy(()=>import("./pages/portal-extras").then(module=>({default:module.AdminAnalytics})));
const AdminCoupons=lazy(()=>import("./pages/portal-extras").then(module=>({default:module.AdminCoupons})));
const AdminCommissions=lazy(()=>import("./pages/portal-extras").then(module=>({default:module.AdminCommissions})));
const InfoPage=lazy(()=>import("./pages/info").then(module=>({default:module.InfoPage})));
const NotFound=lazy(()=>import("./pages/info").then(module=>({default:module.NotFound})));
const Vendors=lazy(()=>import("./pages/info").then(module=>({default:module.Vendors})));
const VendorStore=lazy(()=>import("./pages/info").then(module=>({default:module.VendorStore})));

const router=createBrowserRouter([
  {element:<StoreLayout/>,children:[
    {path:"/",element:<Home/>},{path:"/products",element:<Catalog/>},{path:"/category/:slug",element:<Catalog/>},{path:"/search",element:<Catalog/>},{path:"/new",element:<Catalog mode="new"/>},{path:"/deals",element:<Catalog mode="deals"/>},{path:"/product/:slug",element:<ProductDetail/>},
    {path:"/vendors",element:<Vendors/>},{path:"/vendor/:slug",element:<VendorStore/>},{path:"/login",element:<Login/>},{path:"/register",element:<Register/>},{path:"/verify-email",element:<VerifyEmail/>},{path:"/forgot-password",element:<ForgotPassword/>},{path:"/reset-password",element:<ResetPassword/>},
    {path:"/account",element:<Account/>},{path:"/account/addresses",element:<Addresses/>},{path:"/account/settings",element:<AccountSettings/>},{path:"/wishlist",element:<Wishlist/>},{path:"/cart",element:<CartPage/>},{path:"/checkout",element:<Checkout/>},{path:"/payment/status",element:<PaymentStatus/>},{path:"/orders",element:<Orders/>},{path:"/orders/:id",element:<OrderDetail/>},{path:"/returns",element:<Returns/>},{path:"/notifications",element:<Notifications/>},{path:"/support",element:<Support/>},{path:"/vendor-portal/onboarding",element:<VendorOnboarding/>},
    ...(["about","contact","faq","privacy","terms","shipping","collections"] as const).map(kind=>({path:`/${kind}`,element:<InfoPage kind={kind}/> })),{path:"/returns-policy",element:<InfoPage kind="returns"/>},{path:"*",element:<NotFound/>}
  ]},
  {path:"/vendor-portal",element:<DashboardShell role="VENDOR"/>,children:[{index:true,element:<VendorDashboard/>},{path:"products",element:<VendorProducts/>},{path:"products/new",element:<VendorProductEditor/>},{path:"products/:id",element:<VendorProductEditor/>},{path:"orders",element:<VendorOrders/>},{path:"analytics",element:<VendorAnalytics/>},{path:"coupons",element:<VendorCoupons/>},{path:"returns",element:<VendorReturns/>},{path:"reviews",element:<VendorReviews/>},{path:"commissions",element:<VendorCommissions/>},{path:"payouts",element:<VendorPayouts/>},{path:"notifications",element:<VendorNotifications/>},{path:"support",element:<VendorSupport/>},{path:"settings",element:<VendorSettings/>}]},
  {path:"/admin",element:<DashboardShell role="ADMIN"/>,children:[{index:true,element:<AdminOverview/>},{path:"customers",element:<AdminCustomers/>},{path:"vendors",element:<AdminVendors/>},{path:"products",element:<AdminProducts/>},{path:"orders",element:<AdminOrders/>},{path:"categories",element:<AdminCategories/>},{path:"refunds",element:<AdminReturns/>},{path:"reviews",element:<AdminReviews/>},{path:"analytics",element:<AdminAnalytics/>},{path:"coupons",element:<AdminCoupons/>},{path:"commissions",element:<AdminCommissions/>},{path:"payouts",element:<AdminPayouts/>},{path:"support",element:<AdminSupport/>},{path:"audit",element:<AdminAudit/>},{path:"settings",element:<AdminSettings/>}]}
]);

export function App(){return <Suspense fallback={<Loading label="Preparing AUREVA"/>}><RouterProvider router={router}/></Suspense>}
