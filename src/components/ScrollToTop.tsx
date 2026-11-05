import { useEffect } from "react";
import { useLocation } from "@/lib/router-compat";

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }, [pathname]);

  return null;
};

export default ScrollToTop;
