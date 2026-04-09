<script>
	import "../app.css";
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	let { children } = $props();
	let connected = false; // for preliminary testing.
</script>


<!-- Basic page structure -->
<div class="template">
  <!-- Header -->
  <header class="flex h-24 w-full items-center p-4">
    <!-- Logo -->
    <div class="flex-1">
      <a href='/' class="inline-block">
        <img src="/images/logo.png" alt="logo" class="h-24 w-auto drop-shadow-[0_0_20px_blue]"/>
      </a>
    </div>
    <!-- Title -->
    <div class="flex-1 text-center text-4xl font-bold text-pink-500 drop-shadow-[0_0_20px_blue]">
		<a href='/'>42Brain</a>
    </div>
    <!-- Drop-down menu -->
	<el-dropdown class="flex flex-1 justify-end">
		<button class="cursor-pointer inline-flex gap-x-1.5 rounded-md px-3 py-2 text-sm font-semibold text-pink-500 inset-ring-1 inset-ring-white/5 drop-shadow-[10px_10px_5px_blue] hover:text-blue-500 hover:drop-shadow-[10px_10px_15px_#FF1D8D]">
			Menu
			<svg viewBox="0 0 20 20" fill="currentColor" data-slot="icon" aria-hidden="true" class="-mr-1 size-5 text-gray-400">
			<path d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" fill-rule="evenodd" />
			</svg>
		</button>
		<el-menu anchor="bottom end" popover class="w-25 origin-top-right rounded-md bg-black outline-1 -outline-offset-1 outline-white/10 transition transition-discrete [--anchor-gap:--spacing(2)] data-closed:scale-95 data-closed:transform data-closed:opacity-0 data-enter:duration-100 data-enter:ease-out data-leave:duration-75 data-leave:ease-in">
			<div class="py-1">
				{#if !connected}
					{#if page.url.pathname === '/'}
						<a href="/register" class="block text-center py-2 text-sm text-pink-500 hover:text-blue-500 focus:text-blue-500 focus:outline-hidden">Sign Up</a>
						<a href="/login" class="block text-center py-2 text-sm text-pink-500 hover:text-blue-500 focus:text-blue-500 focus:outline-hidden">Sign In</a>
					{:else if page.url.pathname === '/login'}
						<a href="/" class="block text-center py-2 text-sm text-pink-500 hover:text-blue-500 focus:text-blue-500 focus:outline-hidden">Home</a>
					{:else}
						<a href="/" class="block text-center py-2 text-sm text-pink-500 hover:text-blue-500 focus:text-blue-500 focus:outline-hidden">Home</a>
						<a href="/login" class="block text-center py-2 text-sm text-pink-500 hover:text-blue-500 focus:text-blue-500 focus:outline-hidden">Login</a>
					{/if}
				{:else}
					{#if page.url.pathname === '/'}
						<a href="/game" class="block text-center py-2 text-sm text-pink-500 hover:text-blue-500 focus:text-blue-500 focus:outline-hidden">Game</a>
						<a href="/profile" class="block text-center py-2 text-sm text-pink-500 hover:text-blue-500 focus:text-blue-500 focus:outline-hidden">Profile</a>
						<form action="/" method="POST">
							<button type="submit" class="block w-full py-2 text-center text-sm text-pink-500 hover:text-blue-500 focus:bg-white/5 focus:text-blue-500 focus:outline-hidden">Logout</button>
						</form>
					{:else if page.url.pathname === '/game'}
						<a href="/" class="block text-center py-2 text-sm text-pink-500 hover:text-blue-500 focus:text-blue-500 focus:outline-hidden">Home</a>
						<a href="/profile" class="block text-center py-2 text-sm text-pink-500 hover:text-blue-500 focus:text-blue-500 focus:outline-hidden">Profile</a>
						<form action="/" method="POST">
							<button type="submit" class="block w-full py-2 text-center text-sm text-pink-500 hover:text-blue-500 focus:bg-white/5 focus:text-blue-500 focus:outline-hidden">Logout</button>
						</form>
					{:else if page.url.pathname === '/profile'}
						<a href="/" class="block text-center py-2 text-sm text-pink-500 hover:text-blue-500 focus:text-blue-500 focus:outline-hidden">Home</a>
						<a href="/game" class="block text-center py-2 text-sm text-pink-500 hover:text-blue-500 focus:text-blue-500 focus:outline-hidden">Game</a>
						<form action="/" method="POST">
							<button type="submit" class="block w-full py-2 text-center text-sm text-pink-500 hover:text-blue-500 focus:bg-white/5 focus:text-blue-500 focus:outline-hidden">Logout</button>
						</form>
					{:else}
						<a href="/" class="block text-center py-2 text-sm text-pink-500 hover:text-blue-500 focus:text-blue-500 focus:outline-hidden">Home</a>
						<a href="/game" class="block text-center py-2 text-sm text-pink-500 hover:text-blue-500 focus:text-blue-500 focus:outline-hidden">Game</a>
						<a href="/profile" class="block text-center py-2 text-sm text-pink-500 hover:text-blue-500 focus:text-blue-500 focus:outline-hidden">Profile</a>
						<form action="/" method="POST">
							<button type="submit" class="block w-full py-2 text-center text-sm text-pink-500 hover:text-blue-500 focus:bg-white/5 focus:text-blue-500 focus:outline-hidden">Logout</button>
						</form>
					{/if}
				{/if}
			</div>
		</el-menu>
	</el-dropdown>
  </header>
  
  <!-- Content -->
<main class="grow p-4">
  {@render children()}
</main>
  
  <!-- Footer -->
  <footer class="flex justify-center gap-8 mt-auto text-xs text-pink-500">
    <a href="/terms_of_service" class="hover:text-blue-500">TERMS OF SERVICE</a>
    <a href="/privacy_policy" class="hover:text-blue-500">PRIVACY POLICY</a>
  </footer>
</div>
