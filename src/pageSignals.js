if (typeof window !== "undefined") {
  import("@vercel/analytics")
    .then(({ inject }) => {
      inject({ framework: "vite" });
    })
    .catch(() => {
      // Analytics can be blocked by browser extensions. The app should keep running.
    });
}
