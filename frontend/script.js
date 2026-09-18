/* =========================================================
   WATCHWISE AI — DASHBOARD CONTROLLER
   Works with the FastAPI endpoints:

   GET  /segments
   POST /recommend

   Optional:
   ../evaluator/metrics.json

   ========================================================= */

(() => {
    "use strict";

    /* =========================================================
       CONFIGURATION
    ========================================================= */

    const API_BASE = (
        window.WATCHWISE_API_BASE ||
        "http://127.0.0.1:8000"
    ).replace(/\/$/, "");

    const METRICS_URL = "../evaluator/metrics.json";


    /* =========================================================
       DOM HELPERS
    ========================================================= */

    const $ = (
        selector,
        root = document
    ) => root.querySelector(selector);


    const $$ = (
        selector,
        root = document
    ) => [...root.querySelectorAll(selector)];


    /* =========================================================
       GLOBAL STATE
    ========================================================= */

    const state = {

        segments: {},

        metrics: null,

        apiOnline: false,

        lastRecommendation: null

    };


    /* =========================================================
       PAGE TITLES
    ========================================================= */

    const pageTitles = {

        overview:
            "Audience Overview",

        segments:
            "Audience Segments",

        analyzer:
            "Viewer Analyzer",

        recommendations:
            "Recommendations",

        insights:
            "Audience Insights",

        simulator:
            "What-If Simulator"

    };


    /* =========================================================
       GENERAL HELPERS
    ========================================================= */

    function setText(id, value) {

        const element =
            document.getElementById(id);

        if (!element) {
            return;
        }

        element.textContent =
            value ?? "—";

    }


    function number(
        value,
        fallback = 0
    ) {

        const parsed =
            Number(value);

        return Number.isFinite(parsed)
            ? parsed
            : fallback;

    }


    function formatNumber(
        value,
        decimals = 0
    ) {

        const parsed =
            number(value);

        return parsed.toLocaleString(
            undefined,
            {
                minimumFractionDigits:
                    decimals,

                maximumFractionDigits:
                    decimals
            }
        );

    }


    function percent(
        value,
        decimals = 0
    ) {

        const parsed =
            number(value);

        /*
            API may return:
            0.62
            OR
            62
        */

        const normalized =
            parsed <= 1
                ? parsed * 100
                : parsed;

        return `${normalized.toFixed(decimals)}%`;

    }


    function clamp(
        value,
        min,
        max
    ) {

        return Math.min(
            Math.max(
                number(value),
                min
            ),
            max
        );

    }


    /* =========================================================
       TOAST SYSTEM
    ========================================================= */

    function showToast(
        message,
        type = "info"
    ) {

        let toast =
            $("#watchwise-toast");


        if (!toast) {

            toast =
                document.createElement(
                    "div"
                );

            toast.id =
                "watchwise-toast";

            toast.setAttribute(
                "role",
                "status"
            );

            toast.setAttribute(
                "aria-live",
                "polite"
            );

            document.body.appendChild(
                toast
            );

        }


        toast.className =
            `watchwise-toast ${type}`;

        toast.textContent =
            message;

        toast.classList.add(
            "show"
        );


        clearTimeout(
            showToast.timer
        );


        showToast.timer =
            setTimeout(
                () => {

                    toast.classList.remove(
                        "show"
                    );

                },
                3200
            );

    }


    /* =========================================================
       BUTTON LOADING
    ========================================================= */

    function setButtonLoading(
        button,
        loadingText,
        originalHTML
    ) {

        if (!button) {
            return;
        }


        button.disabled =
            true;


        button.dataset.originalHtml =
            originalHTML ||
            button.innerHTML;


        button.innerHTML =
            `
            <span
                class="button-spinner"
                aria-hidden="true">
            </span>
            ${loadingText}
            `;

    }


    function resetButton(
        button,
        fallbackHTML
    ) {

        if (!button) {
            return;
        }


        button.disabled =
            false;


        button.innerHTML =
            button.dataset.originalHtml ||
            fallbackHTML ||
            "Run";

    }


    /* =========================================================
       API FETCH HELPER
    ========================================================= */

    async function fetchJSON(
        url,
        options = {}
    ) {

        const controller =
            new AbortController();


        const timeout =
            setTimeout(
                () => controller.abort(),
                12000
            );


        try {

            const response =
                await fetch(
                    url,
                    {
                        ...options,

                        signal:
                            controller.signal,

                        headers: {

                            Accept:
                                "application/json",

                            ...(options.headers || {})

                        }

                    }
                );


            const contentType =
                response.headers.get(
                    "content-type"
                ) || "";


            const payload =
                contentType.includes(
                    "application/json"
                )
                    ? await response.json()
                    : await response.text();


            if (!response.ok) {

                const detail =
                    payload?.detail ||
                    payload?.message ||
                    `HTTP ${response.status}`;


                throw new Error(
                    String(detail)
                );

            }


            return payload;

        }

        catch (error) {

            if (
                error.name ===
                "AbortError"
            ) {

                throw new Error(
                    "Request timed out. Please check the FastAPI server."
                );

            }

            throw error;

        }

        finally {

            clearTimeout(
                timeout
            );

        }

    }


    /* =========================================================
       RECOMMENDATION API
    ========================================================= */

    async function getRecommendation(
        viewerData
    ) {

        return fetchJSON(
            `${API_BASE}/recommend`,
            {

                method:
                    "POST",

                headers: {

                    "Content-Type":
                        "application/json"

                },

                body:
                    JSON.stringify(
                        viewerData
                    )

            }
        );

    }


    /* =========================================================
       NAVIGATION
    ========================================================= */

    const sections =
        $$(".dashboard-section");


    const navItems =
        $$(".nav-item");


    const sectionLinks =
        $$("[data-section-link]");


    const pageTitle =
        $("#page-title");


    function showSection(
        sectionId,
        updateHash = true
    ) {

        const selected =
            document.getElementById(
                sectionId
            );


        if (!selected) {
            return;
        }


        sections.forEach(
            section => {

                const active =
                    section.id ===
                    sectionId;


                section.classList.toggle(
                    "active-section",
                    active
                );


                section.setAttribute(
                    "aria-hidden",
                    String(!active)
                );

            }
        );


        navItems.forEach(
            item => {

                const active =
                    item.dataset.section ===
                    sectionId;


                item.classList.toggle(
                    "active",
                    active
                );


                item.setAttribute(
                    "aria-current",
                    active
                        ? "page"
                        : "false"
                );

            }
        );


        if (pageTitle) {

            pageTitle.textContent =
                pageTitles[
                    sectionId
                ] ||
                "WatchWise AI";

        }


        if (
            updateHash &&
            history.replaceState
        ) {

            history.replaceState(
                null,
                "",
                `#${sectionId}`
            );

        }


        window.scrollTo(
            {
                top: 0,
                behavior: "smooth"
            }
        );

    }


    /* =========================================================
       SIDEBAR NAVIGATION
    ========================================================= */

    navItems.forEach(
        item => {

            item.addEventListener(
                "click",
                () => {

                    showSection(
                        item.dataset.section
                    );

                }
            );

        }
    );


    sectionLinks.forEach(
        link => {

            link.addEventListener(
                "click",
                event => {

                    event.preventDefault();

                    showSection(
                        link.dataset.sectionLink
                    );

                }
            );

        }
    );


    /* =========================================================
       MOBILE SIDEBAR
    ========================================================= */

    const sidebar =
        $(".sidebar");


    const topbar =
        $(".topbar");


    if (
        sidebar &&
        topbar &&
        !$("#mobile-menu-button")
    ) {

        const menuButton =
            document.createElement(
                "button"
            );


        menuButton.id =
            "mobile-menu-button";


        menuButton.className =
            "mobile-menu-button";


        menuButton.type =
            "button";


        menuButton.setAttribute(
            "aria-label",
            "Open navigation"
        );


        menuButton.setAttribute(
            "aria-expanded",
            "false"
        );


        menuButton.innerHTML =
            "☰";


        topbar.prepend(
            menuButton
        );


        menuButton.addEventListener(
            "click",
            () => {

                const open =
                    sidebar.classList.toggle(
                        "mobile-open"
                    );


                menuButton.setAttribute(
                    "aria-expanded",
                    String(open)
                );


                menuButton.setAttribute(
                    "aria-label",
                    open
                        ? "Close navigation"
                        : "Open navigation"
                );

            }
        );


        navItems.forEach(
            item => {

                item.addEventListener(
                    "click",
                    () => {

                        sidebar.classList.remove(
                            "mobile-open"
                        );


                        menuButton.setAttribute(
                            "aria-expanded",
                            "false"
                        );

                    }
                );

            }
        );

    }


    /* =========================================================
       API STATUS
    ========================================================= */

    function updateStatusBadges(
        online
    ) {

        const badges =
            $$(".model-badge");


        badges.forEach(
            badge => {

                const originalText =
                    badge.textContent
                        .toLowerCase();


                if (
                    originalText.includes(
                        "api connected"
                    ) ||
                    originalText.includes(
                        "api offline"
                    ) ||
                    originalText.includes(
                        "live ml prediction"
                    )
                ) {

                    badge.classList.toggle(
                        "status-online",
                        online
                    );


                    badge.classList.toggle(
                        "status-offline",
                        !online
                    );


                    badge.textContent =
                        online
                            ? "● API Connected"
                            : "● API Offline";

                }

            }
        );


        const statusDot =
            $(".status-dot");


        const statusText =
            $(".ai-status small");


        if (statusDot) {

            statusDot.classList.toggle(
                "offline",
                !online
            );

        }


        if (statusText) {

            statusText.textContent =
                online
                    ? "Online & Ready"
                    : "API Offline";

        }

    }


    async function checkAPI() {

        try {

            const result =
                await fetchJSON(
                    `${API_BASE}/segments`
                );


            state.apiOnline =
                true;


            updateStatusBadges(
                true
            );


            return result;

        }

        catch (error) {

            state.apiOnline =
                false;


            updateStatusBadges(
                false
            );


            console.warn(
                "WatchWise API unavailable:",
                error.message
            );


            return null;

        }

    }


    /* =========================================================
       SEGMENT DATA
    ========================================================= */

    let segmentData = {};


    function buildSegmentData(
        segments
    ) {

        const entries =
            Object.entries(
                segments || {}
            );


        segmentData =
            {};


        entries.forEach(
            ([id, segment]) => {

                const key =
                    String(id) === "0"
                        ? "casual"
                        : String(id) === "1"
                            ? "binge"
                            : `segment-${id}`;


                segmentData[key] = {

                    title:
                        segment.name ||
                        `Segment ${id}`,


                    count:
                        `${formatNumber(
                            segment.user_count
                        )} viewers`,


                    watch:
                        `${formatNumber(
                            segment.avg_watch_time_hours,
                            1
                        )} hours`,


                    session:
                        `${formatNumber(
                            segment.avg_session_mins,
                            1
                        )} mins`,


                    sessions:
                        formatNumber(
                            segment.avg_session_count,
                            1
                        ),


                    completion:
                        percent(
                            segment.avg_completion_rate
                        ),


                    weekend:
                        percent(
                            segment.avg_weekend_ratio
                        ),


                    description:
                        segment.description ||
                        "Behavioral profile generated from viewer activity."

                };

            }
        );


        return segmentData;

    }


    /* =========================================================
       SELECT SEGMENT
    ========================================================= */

    function selectSegment(
        segmentId
    ) {

        const data =
            segmentData[
                segmentId
            ];


        if (!data) {
            return;
        }


        $$(".segment-card")
            .forEach(
                card => {

                    const selected =
                        card.dataset.segment ===
                        segmentId;


                    card.classList.toggle(
                        "selected-segment",
                        selected
                    );


                    card.setAttribute(
                        "aria-pressed",
                        String(selected)
                    );

                }
            );


        setText(
            "selected-segment-title",
            data.title
        );


        setText(
            "selected-segment-count",
            data.count
        );


        setText(
            "detail-watch",
            data.watch
        );


        setText(
            "detail-session",
            data.session
        );


        setText(
            "detail-sessions",
            data.sessions
        );


        setText(
            "detail-completion",
            data.completion
        );


        setText(
            "detail-weekend",
            data.weekend
        );


        setText(
            "segment-description",
            data.description
        );

    }


    /* =========================================================
       UPDATE SEGMENT CARDS
    ========================================================= */

    function updateSegmentCards(
        segments
    ) {

        const entries =
            Object.entries(
                segments || {}
            );


        const total =
            entries.reduce(
                (
                    sum,
                    [, segment]
                ) =>
                    sum +
                    number(
                        segment.user_count
                    ),
                0
            );


        const casualEntry =
            entries.find(
                ([id, segment]) =>

                    id === "0" ||
                    String(
                        segment.name
                    )
                        .toLowerCase()
                        .includes("casual")
            );


        const bingeEntry =
            entries.find(
                ([id, segment]) =>

                    id === "1" ||
                    String(
                        segment.name
                    )
                        .toLowerCase()
                        .includes("binge")
            );


        function updateCard(
            entry,
            prefix
        ) {

            if (!entry) {
                return;
            }


            const [, data] =
                entry;


            setText(
                `${prefix}-viewers`,
                formatNumber(
                    data.user_count
                )
            );


            setText(
                `${prefix}-watch`,
                `${formatNumber(
                    data.avg_watch_time_hours,
                    1
                )}h`
            );


            setText(
                `${prefix}-completion`,
                percent(
                    data.avg_completion_rate
                )
            );


            setText(
                `${prefix}-percentage`,
                `${total
                    ? (
                        number(
                            data.user_count
                        ) /
                        total *
                        100
                    ).toFixed(1)
                    : "0.0"
                }% of audience`
            );

        }


        updateCard(
            casualEntry,
            "casual"
        );


        updateCard(
            bingeEntry,
            "binge"
        );


        const casualCount =
            casualEntry
                ? number(
                    casualEntry[1].user_count
                )
                : 0;


        const bingeCount =
            bingeEntry
                ? number(
                    bingeEntry[1].user_count
                )
                : 0;


        const casualPct =
            total
                ? casualCount /
                    total *
                    100
                : 0;


        const bingePct =
            total
                ? bingeCount /
                    total *
                    100
                : 0;


        const casualBar =
            $(".distribution-casual");


        const bingeBar =
            $(".distribution-binge");


        if (casualBar) {

            casualBar.style.width =
                `${casualPct}%`;

        }


        if (bingeBar) {

            bingeBar.style.width =
                `${bingePct}%`;

        }


        const distributionTotal =
            $(".distribution-header strong");


        if (distributionTotal) {

            distributionTotal.textContent =
                `${formatNumber(
                    total
                )} viewers`;

        }


        const casualLegend =
            $(".casual-dot")
                ?.parentElement
                ?.querySelector(
                    "strong"
                );


        const bingeLegend =
            $(".binge-dot")
                ?.parentElement
                ?.querySelector(
                    "strong"
                );


        if (casualLegend) {

            casualLegend.textContent =
                `${casualPct.toFixed(1)}%`;

        }


        if (bingeLegend) {

            bingeLegend.textContent =
                `${bingePct.toFixed(1)}%`;

        }


        return {

            total,

            casual:
                casualEntry?.[1],

            binge:
                bingeEntry?.[1]

        };

    }


    /* =========================================================
       LOAD SEGMENTS
    ========================================================= */

    async function loadSegments() {

        try {

            const result =
                await fetchJSON(
                    `${API_BASE}/segments`
                );


            const segments =
                result?.segments ||
                result;


            if (
                !segments ||
                typeof segments !==
                    "object"
            ) {

                throw new Error(
                    "The /segments response does not contain valid segment data."
                );

            }


            state.segments =
                segments;


            buildSegmentData(
                segments
            );


            const summary =
                updateSegmentCards(
                    segments
                );


            state.apiOnline =
                true;


            updateStatusBadges(
                true
            );


            if (
                segmentData.casual
            ) {

                selectSegment(
                    "casual"
                );

            }

            else if (
                Object.keys(
                    segmentData
                ).length
            ) {

                selectSegment(
                    Object.keys(
                        segmentData
                    )[0]
                );

            }


            if (
                summary?.total
            ) {

                setText(
                    "total-viewers",
                    formatNumber(
                        summary.total
                    )
                );

            }


            setText(
                "total-segments",
                Object.keys(
                    segments
                ).length
            );


            updateInsights();


            console.log(
                "WatchWise segments loaded:",
                segments
            );


            return segments;

        }

        catch (error) {

            state.apiOnline =
                false;


            updateStatusBadges(
                false
            );


            console.error(
                "Segment loading failed:",
                error
            );


            return null;

        }

    }


    /* =========================================================
       SEGMENT CARD EVENTS
    ========================================================= */

    $$(".segment-card")
        .forEach(
            card => {

                card.type =
                    "button";


                card.setAttribute(
                    "aria-pressed",
                    card.classList.contains(
                        "selected-segment"
                    )
                        ? "true"
                        : "false"
                );


                card.addEventListener(
                    "click",
                    () => {

                        selectSegment(
                            card.dataset.segment
                        );

                    }
                );

            }
        );


    /* =========================================================
       METRICS
    ========================================================= */

    async function loadMetrics() {

        try {

            const metrics =
                await fetchJSON(
                    METRICS_URL
                );


            state.metrics =
                metrics;


            if (
                metrics.dataset_users
                != null
            ) {

                setText(
                    "total-viewers",
                    formatNumber(
                        metrics.dataset_users
                    )
                );

            }


            if (
                metrics.number_of_segments
                != null
            ) {

                setText(
                    "total-segments",
                    metrics.number_of_segments
                );

            }


            if (
                metrics.avg_watch_time_hours
                != null
            ) {

                setText(
                    "avg-watch-time",
                    `${formatNumber(
                        metrics.avg_watch_time_hours,
                        1
                    )}h`
                );

            }


            if (
                metrics.avg_completion_rate
                != null
            ) {

                setText(
                    "avg-completion",
                    percent(
                        metrics.avg_completion_rate
                    )
                );

            }


            if (
                metrics.silhouette_score
                != null
            ) {

                const score =
                    number(
                        metrics.silhouette_score
                    );


                setText(
                    "silhouette-score",
                    score.toFixed(2)
                );


                let quality;


                if (
                    score >= 0.70
                ) {

                    quality =
                        "Strong segment separation";

                }

                else if (
                    score >= 0.50
                ) {

                    quality =
                        "Good segment separation";

                }

                else if (
                    score >= 0.25
                ) {

                    quality =
                        "Moderate segment separation";

                }

                else {

                    quality =
                        "Weak segment separation";

                }


                setText(
                    "model-quality",
                    quality
                );

            }


            updateDistributionFromMetrics(
                metrics
            );


            updateInsights();


            console.log(
                "WatchWise metrics loaded:",
                metrics
            );


            return metrics;

        }

        catch (error) {

            console.warn(
                "Metrics loading failed:",
                error.message
            );


            setText(
                "model-quality",
                "Metrics unavailable"
            );


            return null;

        }

    }


    /* =========================================================
       DISTRIBUTION FROM METRICS
    ========================================================= */

    function updateDistributionFromMetrics(
        metrics
    ) {

        const distribution =
            metrics?.segment_distribution;


        if (
            !distribution ||
            typeof distribution !==
                "object"
        ) {

            return;

        }


        const total =
            Object.values(
                distribution
            ).reduce(
                (
                    sum,
                    value
                ) =>
                    sum +
                    number(value),
                0
            );


        const casual =
            number(
                distribution["0"]
            );


        const binge =
            number(
                distribution["1"]
            );


        const casualPct =
            total
                ? casual /
                    total *
                    100
                : 0;


        const bingePct =
            total
                ? binge /
                    total *
                    100
                : 0;


        const casualBar =
            $(".distribution-casual");


        const bingeBar =
            $(".distribution-binge");


        if (casualBar) {

            casualBar.style.width =
                `${casualPct}%`;

        }


        if (bingeBar) {

            bingeBar.style.width =
                `${bingePct}%`;

        }


        const totalElement =
            $(".distribution-header strong");


        if (totalElement) {

            totalElement.textContent =
                `${formatNumber(
                    total
                )} viewers`;

        }


        const casualLegend =
            $(".casual-dot")
                ?.parentElement
                ?.querySelector(
                    "strong"
                );


        const bingeLegend =
            $(".binge-dot")
                ?.parentElement
                ?.querySelector(
                    "strong"
                );


        if (casualLegend) {

            casualLegend.textContent =
                `${casualPct.toFixed(1)}%`;

        }


        if (bingeLegend) {

            bingeLegend.textContent =
                `${bingePct.toFixed(1)}%`;

        }

    }


    /* =========================================================
       DYNAMIC AUDIENCE INSIGHTS
    ========================================================= */

    function getSegmentObjects() {

        return Object.entries(
            state.segments
        )
            .map(
                ([id, data]) => ({
                    id,
                    data
                })
            )
            .filter(
                item =>
                    item.data &&
                    typeof item.data ===
                        "object"
            );

    }


    function getNamedSegment(
        preferredNames
    ) {

        const entries =
            getSegmentObjects();


        return entries.find(
            ({ data }) => {

                const name =
                    String(
                        data.name || ""
                    ).toLowerCase();


                return preferredNames.some(
                    term =>
                        name.includes(
                            term
                        )
                );

            }
        )?.data || null;

    }


    function updateInsights() {

        const entries =
            getSegmentObjects();


        if (!entries.length) {
            return;
        }


        const highestWatch =
            [...entries].sort(
                (a, b) =>
                    number(
                        b.data.avg_watch_time_hours
                    ) -
                    number(
                        a.data.avg_watch_time_hours
                    )
            )[0];


        const highestCompletion =
            [...entries].sort(
                (a, b) =>
                    number(
                        b.data.avg_completion_rate
                    ) -
                    number(
                        a.data.avg_completion_rate
                    )
            )[0];


        const largestAudience =
            [...entries].sort(
                (a, b) =>
                    number(
                        b.data.user_count
                    ) -
                    number(
                        a.data.user_count
                    )
            )[0];


        const cards =
            $$(".insight-card p");


        if (
            cards[0] &&
            highestWatch
        ) {

            cards[0].textContent =
                `${highestWatch.data.name || "This segment"} averages ${formatNumber(
                    highestWatch.data.avg_watch_time_hours,
                    1
                )} hours of viewing, compared with lower-engagement segments in the current dataset.`;

        }


        if (
            cards[1] &&
            highestCompletion
        ) {

            cards[1].textContent =
                `${highestCompletion.data.name || "This segment"} has the highest average completion rate at ${percent(
                    highestCompletion.data.avg_completion_rate
                )} in the current dataset.`;

        }


        if (
            cards[2] &&
            largestAudience
        ) {

            cards[2].textContent =
                `${formatNumber(
                    largestAudience.data.user_count
                )} of the analyzed viewers belong to ${largestAudience.data.name || "the largest segment"}.`;

        }


        const comparison =
            $$(".comparison-row");


        const primary =
            getNamedSegment(
                [
                    "casual",
                    "regular"
                ]
            ) ||
            entries[0].data;


        if (!primary) {
            return;
        }


        const values = [

            `${formatNumber(
                primary.avg_watch_time_hours,
                1
            )}h`,

            `${formatNumber(
                primary.avg_session_mins,
                1
            )} mins`,

            percent(
                primary.avg_completion_rate
            ),

            percent(
                primary.avg_weekend_ratio
            )

        ];


        comparison.forEach(
            (
                row,
                index
            ) => {

                const strong =
                    $("strong", row);


                const fill =
                    $(".comparison-fill", row);


                if (
                    strong &&
                    values[index]
                ) {

                    strong.textContent =
                        values[index];

                }


                if (!fill) {
                    return;
                }


                let raw = 0;


                if (
                    index === 0
                ) {

                    const highest =
                        number(
                            highestWatch
                                ?.data
                                ?.avg_watch_time_hours
                        );


                    raw =
                        highest > 0
                            ? number(
                                primary.avg_watch_time_hours
                            ) /
                                highest *
                                100
                            : 0;

                }

                else if (
                    index === 1
                ) {

                    raw =
                        number(
                            primary.avg_session_mins
                        ) /
                        120 *
                        100;

                }

                else if (
                    index === 2
                ) {

                    raw =
                        number(
                            primary.avg_completion_rate
                        ) *
                        100;

                }

                else {

                    raw =
                        number(
                            primary.avg_weekend_ratio
                        ) *
                        100;

                }


                fill.style.width =
                    `${clamp(
                        raw,
                        0,
                        100
                    )}%`;

            }
        );

    }


    /* =========================================================
       VIEWER ANALYZER
    ========================================================= */

    const viewerForm =
        $("#viewer-form");


    const analyzerButton =
        $(".analyzer-button");


    function readViewerForm() {

        return {

            watch_time_hours:
                number(
                    $("#watch-time")
                        ?.value
                ),


            avg_session_mins:
                number(
                    $("#session-mins")
                        ?.value
                ),


            session_count:
                number(
                    $("#session-count")
                        ?.value
                ),


            weekend_ratio:
                clamp(
                    $("#weekend-ratio")
                        ?.value,
                    0,
                    1
                ),


            completion_rate:
                clamp(
                    $("#completion-rate")
                        ?.value,
                    0,
                    1
                ),


            top_genres:
                $("#top-genres")
                    ?.value
                    .trim() ||
                "General"

        };

    }


    function validateViewerData(
        data
    ) {

        const fields = [

            [
                "Watch Time",
                data.watch_time_hours
            ],

            [
                "Average Session",
                data.avg_session_mins
            ],

            [
                "Session Count",
                data.session_count
            ]

        ];


        for (
            const [name, value]
            of fields
        ) {

            if (
                !Number.isFinite(value) ||
                value < 0
            ) {

                showToast(
                    `${name} must be zero or greater.`,
                    "error"
                );


                return false;

            }

        }


        if (
            data.weekend_ratio < 0 ||
            data.weekend_ratio > 1 ||
            data.completion_rate < 0 ||
            data.completion_rate > 1
        ) {

            showToast(
                "Weekend ratio and completion rate must be between 0 and 1.",
                "error"
            );


            return false;

        }


        return true;

    }


    function displayAnalyzerResult(
        result
    ) {

        $("#analyzer-empty")
            ?.classList
            .add("hidden");


        $("#analyzer-result")
            ?.classList
            .remove("hidden");


        setText(
            "result-segment-name",
            result.segment_name ||
            "Unknown segment"
        );


        setText(
            "result-segment-id",
            result.segment_id ??
            "—"
        );


        setText(
            "result-recommendation",
            result.recommendation ||
            "No recommendation returned."
        );

    }


    if (viewerForm) {

        viewerForm.addEventListener(
            "submit",
            async event => {

                event.preventDefault();


                const data =
                    readViewerForm();


                if (
                    !validateViewerData(
                        data
                    )
                ) {

                    return;

                }


                const originalHTML =
                    analyzerButton
                        ?.innerHTML;


                setButtonLoading(
                    analyzerButton,
                    "Analyzing...",
                    originalHTML
                );


                try {

                    const result =
                        await getRecommendation(
                            data
                        );


                    displayAnalyzerResult(
                        result
                    );


                    state.lastRecommendation =
                        {
                            data,
                            result
                        };


                    updateRecommendationPage(
                        result,
                        data
                    );


                    showToast(
                        "Viewer analyzed successfully.",
                        "success"
                    );

                }

                catch (error) {

                    console.error(
                        "Viewer analysis failed:",
                        error
                    );


                    showToast(
                        `Viewer analysis failed: ${error.message}`,
                        "error"
                    );

                }

                finally {

                    resetButton(
                        analyzerButton,
                        "Analyze Viewer <span>→</span>"
                    );

                }

            }
        );

    }


    /* =========================================================
       RECOMMENDATIONS
    ========================================================= */

    const demoViewer = {

        watch_time_hours:
            35,

        avg_session_mins:
            60,

        session_count:
            25,

        weekend_ratio:
            0.40,

        completion_rate:
            0.82,

        top_genres:
            "Drama, Thriller"

    };


    function getRuleForViewer(
        viewerData
    ) {

        if (
            number(
                viewerData.watch_time_hours
            ) >= 30
        ) {

            return "rule-watch";

        }


        if (
            number(
                viewerData.completion_rate
            ) >= 0.80
        ) {

            return "rule-completion";

        }


        if (
            number(
                viewerData.weekend_ratio
            ) >= 0.65
        ) {

            return "rule-weekend";

        }


        const genres =
            String(
                viewerData.top_genres ||
                ""
            )
                .split(",")
                .map(
                    genre =>
                        genre.trim()
                )
                .filter(Boolean);


        if (
            genres.length >= 3
        ) {

            return "rule-genre";

        }


        return null;

    }


    function updateRecommendationReason(
        viewerData
    ) {

        const reason =
            $("#recommendation-reason span");


        if (!reason) {
            return;
        }


        const rule =
            getRuleForViewer(
                viewerData
            );


        const messages = {

            "rule-watch":
                "High watch time triggered the long-form content recommendation.",

            "rule-completion":
                "High completion rate triggered the highly engaging series recommendation.",

            "rule-weekend":
                "High weekend activity triggered the weekend entertainment recommendation.",

            "rule-genre":
                "Multiple genres triggered the discovery recommendation."

        };


        reason.textContent =
            messages[rule] ||
            "Moderate viewing behavior triggered the general content recommendation.";

    }


    function highlightRecommendationRule(
        viewerData
    ) {

        const activeRule =
            getRuleForViewer(
                viewerData
            );


        [
            "rule-watch",
            "rule-completion",
            "rule-weekend",
            "rule-genre"
        ]
            .forEach(
                id => {

                    document
                        .getElementById(id)
                        ?.classList
                        .toggle(
                            "active-rule",
                            id === activeRule
                        );

                }
            );

    }


    function updateRecommendationPage(
        result,
        viewerData
    ) {

        setText(
            "main-recommendation",
            result.recommendation ||
            "No recommendation returned."
        );


        setText(
            "recommendation-segment",
            `Segment ${result.segment_id ?? "—"} · ${result.segment_name || "Unknown"}`
        );


        setText(
            "recommendation-description",
            `${result.segment_name || "The identified segment"} is associated with this recommendation based on the supplied behavioral profile.`
        );


        updateRecommendationReason(
            viewerData
        );


        highlightRecommendationRule(
            viewerData
        );

    }


    async function loadRecommendationPage() {

        try {

            const result =
                await getRecommendation(
                    demoViewer
                );


            updateRecommendationPage(
                result,
                demoViewer
            );


            state.lastRecommendation =
                {
                    data:
                        demoViewer,

                    result
                };

        }

        catch (error) {

            console.warn(
                "Recommendation page could not load live data:",
                error.message
            );


            setText(
                "recommendation-description",
                "Start the FastAPI server to generate a live recommendation."
            );


            updateRecommendationReason(
                demoViewer
            );


            highlightRecommendationRule(
                demoViewer
            );

        }

    }


    /* =========================================================
       RECOMMENDATION BUTTON
    ========================================================= */

    const recommendationAnalyzeBtn =
        $("#recommendation-analyze-btn");


    if (
        recommendationAnalyzeBtn
    ) {

        recommendationAnalyzeBtn.type =
            "button";


        recommendationAnalyzeBtn.addEventListener(
            "click",
            async () => {

                const originalHTML =
                    recommendationAnalyzeBtn
                        .innerHTML;


                setButtonLoading(
                    recommendationAnalyzeBtn,
                    "Analyzing...",
                    originalHTML
                );


                try {

                    const result =
                        await getRecommendation(
                            demoViewer
                        );


                    updateRecommendationPage(
                        result,
                        demoViewer
                    );


                    state.lastRecommendation =
                        {
                            data:
                                demoViewer,

                            result
                        };


                    showToast(
                        "Recommendation refreshed using the demo viewer profile.",
                        "success"
                    );

                }

                catch (error) {

                    console.error(
                        "Recommendation analysis failed:",
                        error
                    );


                    showToast(
                        "Recommendation API is unavailable. Start FastAPI on port 8000.",
                        "error"
                    );

                }

                finally {

                    resetButton(
                        recommendationAnalyzeBtn,
                        "Analyze Viewer"
                    );

                }

            }
        );

    }


    /* =========================================================
       WHAT-IF SIMULATOR
    ========================================================= */

    const simWatchTime =
        $("#sim-watch-time");


    const simSession =
        $("#sim-session");


    const simSessions =
        $("#sim-sessions");


    const simCompletion =
        $("#sim-completion");


    const simWeekend =
        $("#sim-weekend");


    const runSimulation =
        $("#run-simulation");


    function updateSimulationValues() {

        setText(
            "sim-watch-value",
            simWatchTime?.value ??
            "0"
        );


        setText(
            "sim-session-value",
            simSession?.value ??
            "0"
        );


        setText(
            "sim-sessions-value",
            simSessions?.value ??
            "0"
        );


        setText(
            "sim-completion-value",
            simCompletion?.value ??
            "0"
        );


        setText(
            "sim-weekend-value",
            simWeekend?.value ??
            "0"
        );

    }


    [
        simWatchTime,
        simSession,
        simSessions,
        simCompletion,
        simWeekend
    ]
        .forEach(
            slider => {

                slider?.addEventListener(
                    "input",
                    updateSimulationValues
                );


                slider?.addEventListener(
                    "change",
                    updateSimulationValues
                );

            }
        );


    updateSimulationValues();


    /* =========================================================
       RUN SIMULATION
    ========================================================= */

    if (runSimulation) {

        runSimulation.type =
            "button";


        runSimulation.addEventListener(
            "click",
            async () => {

                const viewerData = {

                    watch_time_hours:
                        number(
                            simWatchTime?.value
                        ),


                    avg_session_mins:
                        number(
                            simSession?.value
                        ),


                    session_count:
                        number(
                            simSessions?.value
                        ),


                    weekend_ratio:
                        clamp(
                            number(
                                simWeekend?.value
                            ) / 100,
                            0,
                            1
                        ),


                    completion_rate:
                        clamp(
                            number(
                                simCompletion?.value
                            ) / 100,
                            0,
                            1
                        ),


                    top_genres:
                        $("#sim-genres")
                            ?.value
                            .trim() ||
                        "General"

                };


                const originalHTML =
                    runSimulation
                        .innerHTML;


                setButtonLoading(
                    runSimulation,
                    "Analyzing...",
                    originalHTML
                );


                try {

                    const result =
                        await getRecommendation(
                            viewerData
                        );


                    $("#simulation-empty")
                        ?.classList
                        .add("hidden");


                    $("#simulation-result")
                        ?.classList
                        .remove("hidden");


                    setText(
                        "simulation-segment",
                        result.segment_name ||
                        "Unknown segment"
                    );


                    setText(
                        "simulation-watch",
                        `${formatNumber(
                            viewerData.watch_time_hours,
                            1
                        )}h`
                    );


                    setText(
                        "simulation-completion",
                        percent(
                            viewerData.completion_rate
                        )
                    );


                    setText(
                        "simulation-recommendation",
                        result.recommendation ||
                        "No recommendation returned."
                    );


                    showToast(
                        "Simulation completed successfully.",
                        "success"
                    );

                }

                catch (error) {

                    console.error(
                        "Simulation failed:",
                        error
                    );


                    showToast(
                        "Simulation failed. Make sure the FastAPI server is running on port 8000.",
                        "error"
                    );

                }

                finally {

                    resetButton(
                        runSimulation,
                        "Run Simulation"
                    );

                }

            }
        );

    }


    /* =========================================================
       NOTIFICATION BUTTON
    ========================================================= */

    const notificationButton =
        $(".icon-button[title='Notifications']");


    notificationButton?.addEventListener(
        "click",
        () => {

            if (
                state.apiOnline
            ) {

                showToast(
                    "WatchWise API is connected. Dashboard data is ready.",
                    "success"
                );

            }

            else {

                showToast(
                    "WatchWise API is offline. Start FastAPI to enable live analysis.",
                    "error"
                );

            }

        }
    );


    /* =========================================================
       HASH NAVIGATION
    ========================================================= */

    window.addEventListener(
        "hashchange",
        () => {

            const hash =
                window.location.hash
                    .replace(
                        "#",
                        ""
                    );


            if (
                pageTitles[hash]
            ) {

                showSection(
                    hash,
                    false
                );

            }

        }
    );


    /* =========================================================
       INITIALIZATION
    ========================================================= */

    function initialize() {

        /* -----------------------------------------
           Set accessibility state
        ----------------------------------------- */

        sections.forEach(
            section => {

                section.setAttribute(
                    "aria-hidden",
                    String(
                        !section.classList.contains(
                            "active-section"
                        )
                    )
                );

            }
        );


        /* -----------------------------------------
           Open section from URL hash
        ----------------------------------------- */

        const hash =
            window.location.hash
                .replace(
                    "#",
                    ""
                );


        if (
            pageTitles[hash]
        ) {

            showSection(
                hash,
                false
            );

        }


        /* -----------------------------------------
           Load independent data sources

           A failure in metrics.json should NOT
           prevent the API-powered features.
        ----------------------------------------- */

        loadMetrics();

        loadSegments();

        loadRecommendationPage();

        checkAPI();

    }


    /* =========================================================
       START WATCHWISE
    ========================================================= */

    initialize();

})();