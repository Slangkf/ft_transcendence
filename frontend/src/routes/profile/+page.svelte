<!-- <script lang="ts">
	const { data } = $props();
</script> -->

<div class="flex justify-center pt-12">
	<!-- Card -->
	<div class="flex flex-col items-center justify-center w-full max-w-120 rounded-xl px-6 py-8 border border-slate-700 bg-slate-900/90 backdrop-blur-xs text-white text-sm">
		<!-- Title -->
		<h2 class="text-2xl font-semibold text-pink-500 text-center">Profile</h2>
		<p class="mt-1 text-pink-500 text-center">Your personnal informations</p>

		<!-- Avatar -->
		<img src="/images/avatar.png" alt="avatar" class="h-37 w-37 rounded-full object-cover mt-8">
		<button type="submit" class="cursor-pointer mt-4 px-4 py-2 font-medium text-slate-200 bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">Edit</button>
		
		<!-- Account informations -->
		<div class="flex flex-col w-full px-6 py-6 border border-slate-700 bg-slate-900/90 mt-8 rounded-xl">
			<h3 class="text-lg text-pink-500 mb-4">Account</h3>
			<div class="mb-3">
				<p class="text-sm text-slate-400">Email</p>
				<p class="text-white">user@email.com</p>
				<!-- <p class="text-white">{data.user.email}</p> -->
			</div>
			<div>
				<p class="text-sm text-slate-400">Username</p>
				<p class="text-white">Ruth</p>
				<!-- <p class="text-white">{data.user.username}</p> -->
			</div>
		</div>

		<!-- Password handler -->
		<div class="w-full px-6 py-6 border border-slate-700 bg-slate-900/90 mt-6 rounded-xl">
			<h3 class="text-lg text-pink-500 mb-4">Change password</h3>
			<form>
				<input type="password" placeholder="New password" class="w-full p-2 mb-2 bg-slate-900 border border-slate-700 rounded-md focus:outline-none focus:ring-1 transition focus:ring-indigo-500 focus:border-indigo-500" />
				<input type="password" placeholder="Confirm password" class="w-full p-2 mb-2 bg-slate-900 border border-slate-700 rounded-md focus:outline-none focus:ring-1 transition focus:ring-indigo-500 focus:border-indigo-500" />
				<button class="cursor-pointer mt-4 w-full font-medium text-slate-200 bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">Update password</button>
			</form>
		</div>

		<!-- Statistics -->
		<div class="w-full px-6 py-6 border border-slate-700 bg-slate-900/90 mt-6 rounded-xl">
			<h3 class="text-lg text-pink-500 mb-4">Statistics</h3>
			<div class="flex justify-between">
				<span>Games played</span>
				<span>42</span>
				<!-- <span>{data.user.gamesPlayed}</span> -->
			</div>
			<div class="flex justify-between mt-2">
				<span>Games won</span>
				<span>21</span>
				<!-- <span>{data.user.gamesWon}</span> -->
			</div>
			<div class="flex justify-between mt-2">
				<span>Average score</span>
				<span>82%</span>
				<!-- <span>{data.user.averageScore}%</span> -->
			</div>
		</div>

		<!-- Friends -->
		<div class="w-full px-6 py-6 border border-slate-700 bg-slate-900/90 mt-6 rounded-xl">
			<h3 class="text-lg text-pink-500 mb-4">Social</h3>
			<div class="flex justify-between">
				<span>Friends</span>
				<span>7</span>
			</div>
			<button class="cursor-pointer ursor-pointer mt-4 w-full font-medium text-slate-200 bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">View friends</button>
		</div>
	</div>
</div>
