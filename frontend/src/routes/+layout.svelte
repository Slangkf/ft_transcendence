<script>
  let { children } = $props();
  import "../app.css";
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
	<div class="flex flex-1 justify-end">
		<div class="inline-block group relative">
			<button class="cursor-pointer font-bold text-3xl text-pink-500 hover:text-blue-500">
				&Xi;
			</button>
			<div class="absolute right-0 top-full hidden group-hover:block w-auto bg-black rounded">
				<a class="block text-center font-bold text-pink-500 hover:text-blue-500" href='/login'>LOGIN</a>
				<a class="block text-center font-bold text-pink-500 hover:text-blue-500" href='/logout'>LOGOUT</a>
				<a class="block text-center font-bold text-pink-500 hover:text-blue-500" href='/'>EXIT</a>
			</div>
		</div>
	</div>
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
