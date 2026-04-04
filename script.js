// Logique du Thème Sombre / Clair (Dark Mode)
const themeToggleBtn = document.getElementById('theme-toggle');
const rootElement = document.documentElement; // La balise <html>

// Vérifie la préférence sauvegardée ou celle du système
const currentTheme = localStorage.getItem('theme') || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

// Applique le thème initial au chargement (avant même le DOM ready pour éviter le clignotement)
if (currentTheme === "dark") {
    rootElement.setAttribute("data-theme", "dark");
}

document.addEventListener("DOMContentLoaded", function () {
    // Met à jour l'icône du bouton initialement
    if (themeToggleBtn) {
        if (rootElement.getAttribute("data-theme") === "dark") {
            themeToggleBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
        }

        themeToggleBtn.addEventListener('click', function (e) {
            e.preventDefault(); // Empêche de remonter en haut de la page

            // Bascule le thème
            if (rootElement.getAttribute("data-theme") === "dark") {
                rootElement.removeAttribute("data-theme");
                localStorage.setItem("theme", "light");
                this.innerHTML = '<i class="fa-solid fa-moon"></i>';
            } else {
                rootElement.setAttribute("data-theme", "dark");
                localStorage.setItem("theme", "dark");
                this.innerHTML = '<i class="fa-solid fa-sun"></i>';
            }
        });
    }

    // Initialisation de Locomotive Scroll sur la balise <main data-scroll-container>
    const scrollContainer = document.querySelector('[data-scroll-container]');

    if (scrollContainer) {
        window.locoScroll = new LocomotiveScroll({
            el: scrollContainer,
            smooth: true,
            multiplier: 1,         // Vitesse globale
            touchMultiplier: 3,    // Sensibilité au doigt fortement accélérée
            smartphone: {
                smooth: true       // Réactive les animations
            },
            tablet: {
                smooth: true       // Réactive les animations
            }
        });

        // Mettre à jour les calculs de Locomotive après un court délai
        // pour s'assurer que les polices immenses ont eu le temps d'être dessinées
        setTimeout(() => {
            if (window.locoScroll) window.locoScroll.update();
        }, 500);
    }

    // Initialisation du Menu Hamburger Responsive
    const mobileMenuBtn = document.getElementById('mobile-menu');
    const navMenu = document.querySelector('.menu-droite');

    if (mobileMenuBtn && navMenu) {
        mobileMenuBtn.addEventListener('click', function () {
            navMenu.classList.toggle('active');

            // Change l'icône du hamburger (bars <-> xmark)
            const icon = this.querySelector('i');
            if (navMenu.classList.contains('active')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-xmark');
            } else {
                icon.classList.remove('fa-xmark');
                icon.classList.add('fa-bars');
            }
        });

        // Fermer le menu si on clique sur un lien (sur mobile)
        const navLinks = navMenu.querySelectorAll('a');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    navMenu.classList.remove('active');
                    const icon = mobileMenuBtn.querySelector('i');
                    icon.classList.remove('fa-xmark');
                    icon.classList.add('fa-bars');
                }
            });
        });
    }

});
