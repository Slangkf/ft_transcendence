<script lang="ts">
  function retry() {
    window.location.href = '/api/auth/google';
  }
</script>

<div class="sm:pb-50">
  <div class="flex flex-col items-center gap-4 w-full max-w-80 rounded-xl px-6 py-8 border border-slate-700 bg-slate-900/90 backdrop-blur-xs text-white text-sm text-center">

    <span class="text-xs font-medium px-2.5 py-1 rounded-md bg-red-950 text-red-400">
      Google OAuth
    </span>

    <div class="w-16 h-16 rounded-full bg-red-950 flex items-center justify-center">
      <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </div>

    <div>
      <h2 class="text-xl font-semibold text-white">Google login failed</h2>
      <p class="mt-1 text-slate-400 text-xs leading-relaxed">
        Something went wrong during authentication.<br>Please try again.
      </p>
    </div>

    <button
      onclick={retry}
      class="w-full px-4 py-2.5 font-medium text-slate-200 bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
    >
      Try again
    </button>

    
      href="/login"
      class="w-full px-4 py-2.5 font-medium text-slate-400 bg-slate-800 border border-slate-600 rounded-md hover:bg-slate-700 transition text-center"
    >
      Back to login
    </a>

  </div>
</div>