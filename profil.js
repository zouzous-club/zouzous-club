/* Navigation du profil : conserve les identifiants utilisés par auth.js. */
(function () {
	'use strict';

	function synchroniserProfil(page) {
		const profil = document.getElementById('profilePage');
		const contenu = document.getElementById('content');
		const avertissement = document.querySelector('.shell main > .notice');

		if (!profil || !contenu) {
			return;
		}

		const surProfil = page === 'groupe';

		profil.hidden = !surProfil;
		contenu.hidden = surProfil;

		if (avertissement) {
			avertissement.hidden = surProfil;
		}
	}

	window.zouzousProfileSync = synchroniserProfil;
	synchroniserProfil('accueil');
})();
