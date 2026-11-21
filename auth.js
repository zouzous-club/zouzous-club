																																																									import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
																																															import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
																																	const $ = id => document.getElementById(id);
																																				const shell = document.querySelector('.shell');
																											const authScreen = $('authScreen');
																							const mobile = $('mobileNav');
																																							const params = new URLSearchParams(location.search);
																																																						const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
																																		const invitationGroup = params.get('groupe');
																																																		const callbackType = hashParams.get('type') || params.get('type');
																																																																																												const validUuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
																																																																																																										const configured = SUPABASE_URL.startsWith('https://') && !SUPABASE_URL.includes('VOTRE-PROJET') && !SUPABASE_ANON_KEY.includes('VOTRE_CLE');
										let supabase;
												let currentUser;
									let groupId;
							let role;
																		let processing = false;
																																																									let passwordFlow = callbackType === 'invite' || callbackType === 'recovery';
																															function message(text, isError = false) {
																															$('authMessage').textContent = text;
																																																				$('authMessage').style.color = isError ? '#a72e43' : '#4b359e';
	}
															function show(id) {
																																																									for (const element of document.querySelectorAll('[data-auth-view]')) {
																																			element.hidden = element.id !== id;
					}
	}
																						function setAccess(allowed) {
																						shell.hidden = !allowed;
																							mobile.hidden = !allowed;
																									authScreen.hidden = allowed;
	}
																										function textElement(tag, value) {
																																					const element = document.createElement(tag);
																									element.textContent = value;
																return element;
	}
																							async function loadMembers() {
														if (!groupId)
														return;
																																																			const { data, error } = await supabase.from('membres_groupes')
																																				.select('utilisateur_id,role,statut')
																											.eq('groupe_id', groupId)
																										.eq('statut', 'actif');
																											const list = $('membersList');
																						list.replaceChildren();
													if (error) {
																																																		list.textContent = 'Impossible de charger les membres.';
														return;
					}
																																																															const { data: profiles } = await supabase.from('profils').select('id,prenom');
																																																																				const names = new Map((profiles || []).map(profile => [profile.id, profile.prenom]));
																														const membresUniques = [...new Map((data || []).map(membre => [membre.utilisateur_id, membre])).values()];
	for (const member of membresUniques) {
																																								const row = document.createElement('div');
																													row.className = 'item row';
																																																																																			row.append(textElement('span', `${member.utilisateur_id === currentUser?.id ? 'Moi' : (names.get(member.utilisateur_id)?.trim() || `Compte ${member.utilisateur_id.slice(0, 8)}`)} — ${member.role === 'administrateur' ? 'administrateur' : 'membre'}`));
																																																																	// Le retrait sera réactivé après livraison d'une fonction serveur auditée.
																					list.append(row);
					}
	}
																									async function loadMembership() {
																																																			const { data, error } = await supabase.from('membres_groupes')
																																										.select('groupe_id,role,statut,groupes(nom)')
																									.eq('statut', 'actif')
																	.limit(20);
												if (error)
																	throw error;
																			if (!data?.length) {
																				groupId = null;
																					setAccess(false);
																							show('authPending');
																																																								message('Votre compte ne dispose pas encore d’un accès actif.');
														return;
					}
																									const membership = data[0];
																												groupId = membership.groupe_id;
																						role = membership.role;
																																																																																	$('memberStatus').textContent = `${membership.groupes?.nom || 'Zouzous Club'} · ${currentUser.email}`;
																																																																					$('memberRole').textContent = role === 'administrateur' ? 'Administrateur' : 'Membre';
																																											$('invitePanel').hidden = role !== 'administrateur';
																												$('memberPanel').hidden = false;
																setAccess(true);
																			await loadMembers();
	}
																				async function refresh() {
																									if (processing || !supabase)
														return;
																		processing = true;
								try {
																																																			const { data: { user } } = await supabase.auth.getUser();
																							currentUser = user;
																	if (!user) {
																									setAccess(false);
																										show('authLogin');
																		return;
									}
																							if (passwordFlow) {
																									setAccess(false);
																												show('authPassword');
																																																																message('Définissez votre mot de passe pour terminer l’activation.');
																		return;
									}
																										await loadMembership();
					}
										catch {
																					setAccess(false);
																							show('authPending');
																																																								message('Impossible de vérifier les droits. Réessayez.', true);
					}
											finally {
																							processing = false;
					}
	}
																																													$('loginForm').addEventListener('submit', async (event) => {
																						event.preventDefault();
															if (!supabase)
														return;
																																																												const button = event.currentTarget.querySelector('button[type="submit"]');
																						button.disabled = true;
																																								const form = new FormData(event.currentTarget);
																																																const { error } = await supabase.auth.signInWithPassword({
																																						email: String(form.get('email')).trim(),
																																						password: String(form.get('password')),
							});
																						button.disabled = false;
												if (error)
																																																										message('Connexion impossible. Vérifiez vos identifiants.', true);
							else
																				await refresh();
			});
																																																$('passwordForm').addEventListener('submit', async (event) => {
																						event.preventDefault();
																																																												const button = event.currentTarget.querySelector('button[type="submit"]');
																																																													const password = String(new FormData(event.currentTarget).get('password'));
																									if (password.length < 12) {
																																														message('Utilisez au moins 12 caractères.', true);
														return;
					}
																						button.disabled = true;
								try {
																																																								const { error } = await supabase.auth.updateUser({ password });
																if (error)
																					throw error;
																																if (callbackType === 'invite') {
																																				if (!validUuid(invitationGroup))
																																																															throw new Error('Groupe manquant dans le lien d’invitation.');
																																																																									const { error: activationError } = await supabase.rpc('activer_mon_invitation', {
																																						p_groupe_id: invitationGroup,
															});
																											if (activationError)
																																	throw activationError;
									}
																								passwordFlow = false;
																																														history.replaceState(null, '', location.pathname);
																												message('Compte activé.');
																				await refresh();
					}
																catch (error) {
																																																																										message(`Activation impossible : ${error.message || 'lien invalide ou expiré'}`, true);
					}
											finally {
																										button.disabled = false;
					}
			});
																																													$('resetForm').addEventListener('submit', async (event) => {
																						event.preventDefault();
																																																													const email = String(new FormData(event.currentTarget).get('email')).trim();
																																																							const { error } = await supabase.auth.resetPasswordForEmail(email, {
																																																redirectTo: `${location.origin}${location.pathname}`,
							});
																																																																																		message(error ? 'Demande impossible.' : 'Si le compte existe, un e-mail a été envoyé.', Boolean(error));
			});
																																																																		$('forgotButton').addEventListener('click', () => { show('authReset'); message(''); });
																																																																$('backButton').addEventListener('click', () => { show('authLogin'); message(''); });
																																											$('logoutButton').addEventListener('click', async () => {
																											await supabase.auth.signOut();
																	setAccess(false);
																		show('authLogin');
			});
																																														$('inviteForm').addEventListener('submit', async (event) => {
																						event.preventDefault();
																																																												const button = event.currentTarget.querySelector('button[type="submit"]');
																						button.disabled = true;
																																																													const email = String(new FormData(event.currentTarget).get('email')).trim();
								try {
																																																																	const { data, error } = await supabase.functions.invoke('inviter-membre', {
																																							body: { groupe_id: groupId, email },
											});
																										if (error || !data?.ok)
																																																												throw error || new Error(data?.erreur || 'INVITATION_REFUSEE');
																																																																							$('inviteMessage').textContent = 'Invitation envoyée. Elle reste valable 7 jours.';
																													event.currentTarget.reset();
					}
										catch {
																																																																																								$('inviteMessage').textContent = 'Invitation impossible : vérifier la configuration ou le compte invité.';
					}
											finally {
																										button.disabled = false;
					}
			});
													setAccess(false);
														if (!configured) {
																			show('authPending');
																																																														message('Complétez config.js avec l’URL et la clé publique Supabase.', true);
	}
					else {
																																																supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
																																																																					auth: { detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
							});
																																					supabase.auth.onAuthStateChange((event) => {
																																		if (event === 'PASSWORD_RECOVERY')
																											passwordFlow = true;
																																							setTimeout(() => { void refresh(); }, 0);
							});
																void refresh();
	}

