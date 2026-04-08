export const checkStorageVersion = () => {
    const APP_VERSION = "V1.0";
    const storedVersion = localStorage.getItem("app_version");
  
    const keysToKeep = ["cart", "large_text_mode"];
  
    if (storedVersion !== APP_VERSION) {
      Object.keys(localStorage).forEach((key) => {
        if (!keysToKeep.includes(key)) {
          localStorage.removeItem(key);
        }
      });
  
      localStorage.setItem("app_version", APP_VERSION);
    }
  };