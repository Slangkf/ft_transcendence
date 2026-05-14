<script lang="ts">
	const { data } = $props();
</script>

<!-- Main card -->
<div class="flex flex-col items-center justify-center w-full max-w-200 rounded-xl p-4 border border-slate-700 bg-slate-900/90 backdrop-blur-xs text-white text-sm">
	<!-- Main card title -->
	<h2 class="text-2xl font-semibold text-pink-500 text-center">Chat</h2>
	<p class="mt-1 text-pink-500 text-center">Your chat with</p>
	
    <!-- Messages zone -->
    <div class="flex flex-col w-full px-6 py-6 border border-slate-700 bg-slate-900/90 mt-8 rounded-xl h-200 overflow-y-auto gap-3">
        <!-- Messages will go here -->
    </div>
	
    <!-- Input zone -->
    <div class="flex items-center w-full px-6 py-4 mt-4 rounded-xl gap-3">
        <input type="text" placeholder="Write a message" class="flex-1 bg-slate-800 border border-slate-700 text-white text-sm rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-500"/>
        <button class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500">Send</button>
    </div>
</div>
