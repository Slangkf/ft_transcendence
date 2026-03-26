<script>
  let { children } = $props();
  import "../app.css";
  import { page } from '$app/state';

  let connected = true;

  // Dynamic links
  let headerLinks = [
    { href: "/login", text: "LOGIN" },
    { href: "/logout", text: "LOGOUT" },
    { href: "/", text: "HOME" },
    { href: "/game", text: "GAME" },
    { href: "/profile", text: "PROFILE" }
  ];
</script>

<!-- Template -->
<div class="background">
  <header class="h-16 sm:h-20 md:h-24 w-full flex items-center">

    <!-- Logo -->
    <div class="flex flex-1 justify-start">
      <a href='/'>
        <img src="/images/logo.png" alt="logo" class="h-12 sm:h-16 md:h-20 lg:h-24 w-auto"/>
      </a>
    </div>

    <!-- Dynamic links -->
    <nav class="flex flex-1 justify-center gap-8 text-xs sm:text-sm md:text-base">
    {#if !connected}
      {#if page.url.pathname === '/'}
        <a href="/login">LOGIN</a>
      {:else if page.url.pathname == '/game'}
        <a href="/login">LOGIN</a>
        <a href="/">HOME</a>
      {:else}
        <a href="/">HOME</a>
      {/if}
    {:else if connected}
      {#if page.url.pathname === '/'}
        <a href="/game">GAME</a>
        <a href="/profile">PROFILE</a>
        <a href="/logout">LOGOUT</a>
      {:else if page.url.pathname === '/profile'}
        <a href="/">HOME</a>
        <a href="/game">GAME</a>
        <a href="/logout">LOGOUT</a>
      {:else if page.url.pathname === '/game'}
        <a href="/">HOME</a>
        <a href="/profile">PROFILE</a>
        <a href="/logout">LOGOUT</a>
      {:else}
          <a href="/">HOME</a>
      {/if}
    {/if}
    </nav>

    <!-- Empty space to balance -->
    <div class="flex-1"></div>
  </header>
  
  <!-- Content -->
  <main class="grow">
    {@render children()}
  </main>
  
  <!-- Bottom buttons -->
  <footer class="flex justify-center gap-8 mt-auto p-4 text-xs text-white">
    <a href="/terms_of_service" class="hover:text-gray-300">TERMS OF SERVICE</a>
    <a href="/privacy_policy" class="hover:text-gray-300">PRIVACY POLICY</a>
  </footer>
</div>
