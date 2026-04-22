<!-- <script lang="ts">
	const { data } = $props();
</script> -->

<!-- Main card -->
<div class="flex flex-col items-center justify-center w-full max-w-200 rounded-xl p-4 border border-slate-700 bg-slate-900/90 backdrop-blur-xs text-white text-sm">
	<!-- Main card title -->
	<h2 class="text-2xl font-semibold text-pink-500 text-center">Profile</h2>
	<p class="mt-1 text-pink-500 text-center">Your personnal informations</p>
	<!-- Avatar -->
	<img src="/images/avatar.png" alt="avatar" class="h-37 w-37 rounded-full object-cover mt-8">
	<!-- Edit avatar button -->
	<button type="submit" class="cursor-pointer mt-4 px-4 py-2 font-medium text-slate-200 bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">Edit</button>
	<!-- Account information card -->
	<div class="flex flex-col w-full px-6 py-6 border border-slate-700 bg-slate-900/90 mt-8 rounded-xl">
		<!-- Title -->
		<h3 class="text-lg text-pink-500 mb-4">Account</h3>
		<!-- Informations -->
		<div class="flex justify-between mb-3">
			<span class="text-sm text-slate-400">Email</span>
			<span class="text-white">user@email.com</span>
			<!-- <span class="text-white">{data.user.email}</span> -->
		</div>
		<div class="flex justify-between mb-3">
			<span class="text-sm text-slate-400">Username</span>
			<span class="text-white">Ruth</span>
			<!-- <span class="text-white">{data.user.username}</span> -->
		</div>
	</div>
	<!-- Username handler -->
	<div class="w-full px-6 py-6 border border-slate-700 bg-slate-900/90 mt-6 rounded-xl">
		<!-- Title -->
		<h3 class="text-lg text-pink-500 mb-4">Change username</h3>
		<!-- New username shield -->
		<form>
			<input type="text" placeholder="New username" class="w-full p-2 mb-2 bg-slate-900 border border-slate-700 rounded-md focus:outline-none focus:ring-1 transition focus:ring-indigo-500 focus:border-indigo-500" />
			<!-- Update button -->
			<button class="cursor-pointer mt-4 w-full font-medium text-slate-200 bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">Update username</button>
		</form>
	</div>
	<!-- Password handler -->
	<div class="w-full px-6 py-6 border border-slate-700 bg-slate-900/90 mt-6 rounded-xl">
		<!-- Title -->
		<h3 class="text-lg text-pink-500 mb-4">Change password</h3>
		<!-- New password shields -->
		<form>
			<input type="password" placeholder="New password" class="w-full p-2 mb-2 bg-slate-900 border border-slate-700 rounded-md focus:outline-none focus:ring-1 transition focus:ring-indigo-500 focus:border-indigo-500" />
			<input type="password" placeholder="Confirm password" class="w-full p-2 mb-2 bg-slate-900 border border-slate-700 rounded-md focus:outline-none focus:ring-1 transition focus:ring-indigo-500 focus:border-indigo-500" />
			<!-- Update button -->
			<button class="cursor-pointer mt-4 w-full font-medium text-slate-200 bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">Update password</button>
		</form>
	</div>
	<!-- Statistic card -->
	<div class="w-full px-6 py-6 border border-slate-700 bg-slate-900/90 mt-6 rounded-xl">
		<!-- Statistic title -->
		<h3 class="text-lg text-pink-500 mb-4">Statistics</h3>
		<!-- Statistic cards -->
		<div class="flex justify-between">
			<span class="text-sm text-slate-400">Games played</span>
			<span>42</span>
			<!-- <span>{data.user.gamesPlayed}</span> -->
		</div>
		<div class="flex justify-between mt-2">
			<span class="text-sm text-slate-400">Games won</span>
			<span>21</span>
			<!-- <span>{data.user.gamesWon}</span> -->
		</div>
		<div class="flex justify-between mt-2">
			<span class="text-sm text-slate-400">Average score</span>
			<span>82%</span>
			<!-- <span>{data.user.averageScore}%</span> -->
		</div>
	</div>
	<!-- Friend card-->
	<div class="w-full px-6 py-6 border border-slate-700 bg-slate-900/90 mt-6 rounded-xl">
		<!-- Title -->
		<h3 class="text-lg text-pink-500 mb-4">Social</h3>
		<!-- Statistics -->
		<div class="flex justify-between">
			<span class="text-sm text-slate-400">Friends</span>
			<span>7</span>
		</div>
		<!-- View Friends button -->
		<button class="cursor-pointer ursor-pointer mt-4 w-full font-medium text-slate-200 bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">View friends</button>
	</div>
</div>