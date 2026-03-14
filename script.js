// Attendre que la page HTML soit complètement chargée
document.addEventListener("DOMContentLoaded", function () {

    // Initialisation de Locomotive Scroll sur la balise <main data-scroll-container>
    const scrollContainer = document.querySelector('[data-scroll-container]');

    if (scrollContainer) {
        const locoScroll = new LocomotiveScroll({
            el: scrollContainer,
            smooth: true,
            smartphone: {
                smooth: true
            },
            tablet: {
                smooth: true
            }
        });

        // Mettre à jour les calculs de Locomotive après un court délai
        // pour s'assurer que les polices immenses ont eu le temps d'être dessinées
        setTimeout(() => {
            locoScroll.update();
        }, 500);
    }

});
