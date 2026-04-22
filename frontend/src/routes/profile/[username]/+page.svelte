<!-- <script lang="ts">
	const { data } = $props();
</script> -->

<!-- Main card -->
<div class="flex flex-col items-center justify-center w-full max-w-120 rounded-xl px-6 py-8 border border-slate-700 bg-slate-900/90 backdrop-blur-xs text-white text-sm">
	<!-- Main card title -->
	<h2 class="text-2xl font-semibold text-pink-500 text-center">Profile</h2>
	<!-- Avatar -->
	<img src="/images/avatar.png" alt="avatar" class="h-37 w-37 rounded-full object-cover mt-8">
	<!-- Add friend button -->
	<button type="submit" class="cursor-pointer mt-4 px-4 py-2 font-medium text-slate-200 bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">Add friend</button>
	<!-- Account information card -->
	<div class="flex flex-col w-full px-6 py-6 border border-slate-700 bg-slate-900/90 mt-8 rounded-xl">
		<!-- Title -->
		<h3 class="text-lg text-pink-500 mb-4">Account</h3>
		<!-- Informations -->
		<div>
			<p class="text-sm text-slate-400">Username</p>
			<p class="text-white">Ruth</p>
			<!-- <p class="text-white">{data.user.username}</p> -->
		</div>
	</div>

	<!-- Statistic card-->
	<div class="w-full px-6 py-6 border border-slate-700 bg-slate-900/90 mt-6 rounded-xl">
	<!-- Statistic title -->
		<h3 class="text-lg text-pink-500 mb-4">Statistics</h3>
		<!-- Statistic cards -->
		<div class="flex justify-between">
			<span>Games played</span>
			<span>42</span>
		</div>
		<div class="flex justify-between mt-2">
			<span>Games won</span>
			<span>21</span>
		</div>
		<div class="flex justify-between mt-2">
			<span>Average score</span>
			<span>82%</span>
		</div>
	</div>

	<!-- Friend card -->
	<div class="w-full px-6 py-6 border border-slate-700 bg-slate-900/90 mt-6 rounded-xl">
		<!-- Title -->
		<h3 class="text-lg text-pink-500 mb-4">Social</h3>
		<!-- Statistics -->
		<div class="flex justify-between">
			<span>Friends</span>
			<span>7</span>
		</div>
		<!-- View username's Friends button -->
		<button class="cursor-pointer ursor-pointer mt-4 w-full font-medium text-slate-200 bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">View username's friends</button>
	</div>
</div>
