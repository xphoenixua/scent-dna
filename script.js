// geometry constants
const BOTTLE_WIDTH_NORM = 0.38;
const BOTTLE_CAP_HEIGHT_NORM = 0.18;
const BOTTLENECK_HEIGHT_NORM = 0.16;
const BOTTLE_BODY_HEIGHT_NORM = 0.42;
const BOTTLE_CAP_Y_START_NORM = 0.25;
const BOTTLENECK_Y_START_NORM = BOTTLE_CAP_Y_START_NORM + BOTTLE_CAP_HEIGHT_NORM;
const BOTTLE_BODY_Y_START_NORM = BOTTLENECK_Y_START_NORM + BOTTLENECK_HEIGHT_NORM;
const BOTTLENECK_WIDTH_FACTOR = 0.5;
const BOTTLE_CAP_WIDTH_FACTOR = 0.65;
const X_CENTER_MAIN_BOTTLE_NORM = 0.50;


// style and interaction constants
const NOTE_COLORS = ['#FADCD3', '#FBE3CF', '#FCF4DE', '#DEECE8', '#D3E3ED', '#E1D8E1'];
const ACCORD_COLORS = ['#EBC2CA', '#F3D2C4', '#FBEACF', '#D6E7DF', '#C8DBEC', '#E5DDE5'];
const SATURATED_NOTE_COLORS = ['#E6A090', '#F2C49D', '#F7E3AF', '#B2D6C8', '#8FB9D4', '#B39DB3'];
const SATURATED_ACCORD_COLORS = ['#D18A9A', '#E8B19D', '#F7D6A4', '#A8C9B8', '#9DBED7', '#C6B2C6'];
const TEXT_VISIBILITY_THRESHOLD_PX = 10;
const BOTTLE_OUTLINE_PADDING_PX = 5;
const TRANSITION_DURATION = 750;


// data filtering constants
const MINIMUM_PERFUMES_PER_BRAND = 10;
const MINIMUM_RATING_COUNT = 100;
const MINIMUM_INGREDIENT_APPEARANCES = 100;
const HIGH_STDEV_THRESHOLD = 0.60;
const LOW_STDEV_THRESHOLD = 0.60;


// svg and margin setup
const svgRealWidth = 800;
const svgRealHeight = 700;
const margin = { top: 10, right: 20, bottom: 150, left: 20 };
const vizWidth = svgRealWidth - margin.left - margin.right;
const vizHeight = svgRealHeight - margin.top - margin.bottom;


// global state
let df_original = [];
let ingredientStats = new Map();

const brandDropdown = document.getElementById('brand-dropdown');
const vizContainer = d3.select("#visualization-container");
const tooltip = d3.select("body").append("div").attr("class", "tooltip");


function getBrandScentProfile(df, brandName, topNNotes = 4, topNAccords = 5) {
    const brandDf = df.filter(d => d.Brand === brandName);

    const getEmptyProfile = (idPrefix) => ({
        proportions: new Map([['N/A', 100.0]]),
        customdata: [{ type: 'N/A', label: 'N/A', percentage: 100.0, id: `${idPrefix}_na_0` }]
    });

    if (!brandDf.length) {
        return {
            base_notes: getEmptyProfile("base"),
            middle_notes: getEmptyProfile("middle"),
            top_notes: getEmptyProfile("top"),
            main_accords: getEmptyProfile("accord")
        };
    }

    const getProportions = (columnName, topN, typeName, idPrefix) => {
        const allItems = brandDf.flatMap(row => (row[columnName] || '').toLowerCase().split(/,\s*/))
            .filter(item => item && item.trim() !== '' && item.trim() !== 'na');

        if (!allItems.length) return getEmptyProfile(idPrefix);

        const counts = d3.rollup(allItems, v => v.length, d => d);
        const sortedItems = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, topN);
        const totalCount = d3.sum(sortedItems, d => d[1]);

        if (totalCount === 0) return getEmptyProfile(idPrefix);

        const proportions = new Map(sortedItems.map(([item, count]) => [item, (count / totalCount) * 100]));
        const customdata = Array.from(proportions.entries()).map(([label, percentage], i) => ({
            type: typeName,
            label: label.charAt(0).toUpperCase() + label.slice(1),
            percentage,
            id: `${idPrefix}_${label.replace(/\s+/g, '-')}_${i}`
        }));

        return { proportions, customdata };
    };

    return {
        base_notes: getProportions('Base_Notes', topNNotes, "Base Note", "base"),
        middle_notes: getProportions('Middle_Notes', topNNotes, "Middle Note", "middle"),
        top_notes: getProportions('Top_Notes', topNNotes, "Top Note", "top"),
        main_accords: getProportions('Main_Accords', topNAccords, "Accord", "accord")
    };
}


function drawStackedSegments(selection, data, totalHeight, width, colorScale) {
    let currentY = 0;
    data.forEach(d => {
        d.yPos = currentY;
        currentY += (d.percentage / 100) * totalHeight;
    });

    const segments = selection.selectAll("g.segment-group")
        .data(data, d => d.id);

    segments.exit()
        .transition().duration(TRANSITION_DURATION)
        .attr("transform", `translate(0, ${vizHeight})`)
        .style("opacity", 0)
        .remove();

    const enterG = segments.enter()
        .append("g")
        .attr("class", "segment-group")
        .attr("transform", `translate(0, ${vizHeight})`);

    enterG.append("rect")
        .attr("class", "segment-outline")
        .attr("width", width)
        .attr("fill", d => colorScale(d.label));

    enterG.append("text")
        .attr("class", "segment-label")
        .attr("x", width / 2)
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em");

    const updateG = enterG.merge(segments);
    
    updateG.transition().duration(TRANSITION_DURATION)
        .attr("transform", d => `translate(0, ${d.yPos})`);

    updateG.select("rect")
        .transition().duration(TRANSITION_DURATION)
        .attr("height", d => (d.percentage / 100) * totalHeight);

    updateG.select("text")
        .transition().duration(TRANSITION_DURATION)
        .attr("y", d => ((d.percentage / 100) * totalHeight) / 2)
        .text(d => {
            const segHeight = (d.percentage / 100) * totalHeight;
            if (segHeight < TEXT_VISIBILITY_THRESHOLD_PX) return "";
            return `${d.label} (${d.percentage.toFixed(0)}%)`;
        });
        
    return updateG;
}


function createPerfumeBottleShell(bottleGroup, dims, pad) {
    bottleGroup.append("rect")
        .attr("x", dims.capX - pad).attr("y", dims.capY - pad)
        .attr("width", dims.capW + 2 * pad).attr("height", dims.capH + 2 * pad)
        .attr("fill", "#f0f0f0").attr("rx", 6);

    bottleGroup.append("rect")
        .attr("x", dims.neckX - pad).attr("y", dims.neckY)
        .attr("width", dims.neckW + 2 * pad).attr("height", dims.neckH)
        .attr("fill", "#f0f0f0");

    bottleGroup.append("rect")
        .attr("x", dims.bodyX - pad).attr("y", dims.bodyY - pad)
        .attr("width", dims.bodyW + 2 * pad).attr("height", dims.bodyH + 2 * pad)
        .attr("fill", "#f0f0f0").attr("rx", 6);
}


function createScentCloud(bottleGroup, accordsData, colorScales, dims) {
    const bottleCenterX = X_CENTER_MAIN_BOTTLE_NORM * vizWidth - 20;
    const bottleCenterY = dims.bodyY + dims.bodyH - 200; 
    const orbitRx = dims.bodyW / 2 + 100;
    const orbitRy = dims.bodyH / 2 + 200;
    const radiusScale = d3.scaleSqrt().domain([0, d3.max(accordsData, d => d.percentage)]).range([12, vizWidth * 0.06]);

    const accordNodes = accordsData.map((d, i) => {
        const startAngle = 1.0 * Math.PI;
        const angleRange = 1.4 * Math.PI;
        const angle = startAngle + (i / accordsData.length) * angleRange;
        return {
            ...d,
            radius: radiusScale(d.percentage) || 0,
            targetX: bottleCenterX + orbitRx * Math.cos(angle),
            targetY: bottleCenterY + orbitRy * Math.sin(angle)
        };
    });

    d3.forceSimulation(accordNodes)
        .force("collide", d3.forceCollide().radius(d => d.radius + 4).strength(1))
        .force("x", d3.forceX(d => d.targetX).strength(0.5))
        .force("y", d3.forceY(d => d.targetY).strength(0.5))
        .stop().tick(120);

    const startX = bottleCenterX;
    const startY = dims.bodyY + dims.bodyH / 2 - 50;
    const node = bottleGroup.append("g").attr("class", "accords-orbit")
        .selectAll("g.accord-node").data(accordNodes).enter().append("g")
        .attr("class", "accord-node").attr("transform", `translate(${startX}, ${startY})`);

    node.append("circle").attr("r", 0).attr("fill", d => colorScales.Accord(d.label));
    node.append("text").attr("text-anchor", "middle")
        .style("font-size", d => Math.max(9, d.radius / 2.8) + "px")
        .style("pointer-events", "none").style("fill", "#333").style("opacity", 0)
        .selectAll("tspan").data(d => [`${d.label || ""}`, `(${d.percentage.toFixed(0)}%)`]).enter()
        .append("tspan").attr("x", 0).attr("dy", (d, i) => i === 0 ? "-0.3em" : "1.1em").text(d => d);

    node.transition().duration(800).delay((d, i) => 200 + i * 50).ease(d3.easeCubicOut).attr("transform", d => `translate(${d.x}, ${d.y})`);
    node.select("circle").transition().duration(800).delay((d, i) => 200 + i * 50).ease(d3.easeCubicOut).attr("r", d => d.radius);
    node.select("text").transition().duration(600).delay((d, i) => 400 + i * 50).style("opacity", 1);
    
    return node;
}


function createBottleLabels(bottleGroup, dims) {
    bottleGroup.append("text").attr("class", "section-label")
        .attr("x", X_CENTER_MAIN_BOTTLE_NORM * vizWidth).attr("y", dims.capY - 15)
        .attr("text-anchor", "middle").text("Top Notes");
        
    const middleLabel = bottleGroup.append("text").attr("class", "section-label")
        .attr("text-anchor", "end")
        .attr("transform", `translate(${dims.neckX - 15}, ${dims.neckY + dims.neckH / 2})`);
    middleLabel.append("tspan").attr("x", 0).attr("dy", "-0.6em").text("MIDDLE");
    middleLabel.append("tspan").attr("x", 0).attr("dy", "1.2em").text("NOTES");

    bottleGroup.append("text").attr("class", "section-label")
        .attr("x", X_CENTER_MAIN_BOTTLE_NORM * vizWidth).attr("y", dims.bodyY + dims.bodyH + 20)
        .attr("text-anchor", "middle").text("Base Notes");
}


function drawPerfumeDna(selectedBrand) {
    vizContainer.selectAll("svg").remove();
    const svg = vizContainer.append("svg").attr("width", svgRealWidth).attr("height", svgRealHeight);
    if (!selectedBrand) {
        svg.append("text").attr("x", svgRealWidth / 2).attr("y", svgRealHeight / 2).attr("text-anchor", "middle").text("Please select a brand");
        return;
    }

    const profile = getBrandScentProfile(df_original, selectedBrand);
    const bottleGroup = svg.append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    const dims = {
        capW: (BOTTLE_WIDTH_NORM * BOTTLE_CAP_WIDTH_FACTOR) * vizWidth,
        capX: (X_CENTER_MAIN_BOTTLE_NORM * vizWidth) - ((BOTTLE_WIDTH_NORM * BOTTLE_CAP_WIDTH_FACTOR) * vizWidth / 2),
        capY: BOTTLE_CAP_Y_START_NORM * vizHeight, capH: BOTTLE_CAP_HEIGHT_NORM * vizHeight,
        neckW: (BOTTLE_WIDTH_NORM * BOTTLENECK_WIDTH_FACTOR) * vizWidth,
        neckX: (X_CENTER_MAIN_BOTTLE_NORM * vizWidth) - ((BOTTLE_WIDTH_NORM * BOTTLENECK_WIDTH_FACTOR) * vizWidth / 2),
        neckY: BOTTLENECK_Y_START_NORM * vizHeight, neckH: BOTTLENECK_HEIGHT_NORM * vizHeight,
        bodyW: BOTTLE_WIDTH_NORM * vizWidth,
        bodyX: (X_CENTER_MAIN_BOTTLE_NORM * vizWidth) - (BOTTLE_WIDTH_NORM * vizWidth / 2),
        bodyY: BOTTLE_BODY_Y_START_NORM * vizHeight, bodyH: BOTTLE_BODY_HEIGHT_NORM * vizHeight
    };
    
    const colorScales = { Note: d3.scaleOrdinal(NOTE_COLORS), Accord: d3.scaleOrdinal(ACCORD_COLORS) };

    const handleMouseOver = (event, d) => {
        tooltip.style("opacity", 1);
        const typeKey = d.type.includes("Note") ? "Note" : "Accord";
        const basePalette = typeKey === "Note" ? NOTE_COLORS : ACCORD_COLORS;
        const hoverPalette = typeKey === "Note" ? SATURATED_NOTE_COLORS : SATURATED_ACCORD_COLORS;
        const defaultColor = colorScales[typeKey](d.label);
        const colorIndex = basePalette.indexOf(defaultColor);
        if (colorIndex === -1) return;

        const shape = d3.select(event.currentTarget).select(typeKey === "Note" ? "rect" : "circle");
        shape.attr("fill", hoverPalette[colorIndex]).transition().duration(200)
            .attr("stroke", "#333").attr("stroke-width", 2);
    };

    const handleMouseMove = (event, d) => {
        const lowerCaseLabel = d.label.toLowerCase();
        const stats = ingredientStats.get(lowerCaseLabel);
        
        const brandPerfumes = df_original.filter(p => p.Brand === selectedBrand);
        const noteInBrandCount = brandPerfumes.filter(p => 
            (p.Top_Notes.toLowerCase().includes(lowerCaseLabel) ||
            p.Middle_Notes.toLowerCase().includes(lowerCaseLabel) ||
            p.Base_Notes.toLowerCase().includes(lowerCaseLabel) ||
            p.Main_Accords.toLowerCase().includes(lowerCaseLabel))
        ).length;
        const brandAffinity = (noteInBrandCount / brandPerfumes.length) * 100;
        
        let statsHtml = `<hr style="border: 0; border-top: 1px solid #eee; margin: 6px 0;">`;

        if (brandAffinity > 0) {
            statsHtml += `<div>Used in <strong>${brandAffinity.toFixed(0)}%</strong> of this brand's perfumes.</div>`;
        }
        
        if (stats && stats.brandRatings.has(selectedBrand) && stats.sortedBrandAvgRatings.length > 1) {
            const brandAvgRating = stats.brandRatings.get(selectedBrand);
            const brandsWithLowerScore = stats.sortedBrandAvgRatings.filter(r => r < brandAvgRating).length;
            const percentile = (brandsWithLowerScore / stats.sortedBrandAvgRatings.length) * 100;
            statsHtml += `<div>Rated better than <strong>${percentile.toFixed(0)}%</strong> of other brands.</div>`;
        }

        if (stats && stats.ratingStDev) {
            if (stats.ratingStDev > HIGH_STDEV_THRESHOLD) {
                statsHtml += `<div>A divisive note (high rating variance).</div>`;
            } else if (stats.ratingStDev <= LOW_STDEV_THRESHOLD) {
                statsHtml += `<div>A consistent favorite (low rating variance).</div>`;
            }
        }
        
        const tooltipHtml = `<div class="tooltip-type">${d.type}</div>
                            <div>${d.label}: <strong>${d.percentage.toFixed(1)}%</strong> share within category</div>
                            ${statsHtml}`;
        tooltip.html(tooltipHtml).style("left", `${event.pageX + 15}px`).style("top", `${event.pageY - 28}px`);
    };

    const handleMouseOut = (event, d) => {
        tooltip.style("opacity", 0);
        const typeKey = d.type.includes("Note") ? "Note" : "Accord";
        const shape = d3.select(event.currentTarget).select(typeKey === "Note" ? "rect" : "circle");
        shape.attr("fill", colorScales[typeKey](d.label)).transition().duration(200).attr("stroke", "none");
    };

    createPerfumeBottleShell(bottleGroup, dims, BOTTLE_OUTLINE_PADDING_PX);

    const topNotesSelection = drawStackedSegments(bottleGroup.append("g").attr("transform", `translate(${dims.capX}, ${dims.capY})`), profile.top_notes.customdata, dims.capH, dims.capW, colorScales.Note);
    const middleNotesSelection = drawStackedSegments(bottleGroup.append("g").attr("transform", `translate(${dims.neckX}, ${dims.neckY})`), profile.middle_notes.customdata, dims.neckH, dims.neckW, colorScales.Note);
    const baseNotesSelection = drawStackedSegments(bottleGroup.append("g").attr("transform", `translate(${dims.bodyX}, ${dims.bodyY})`), profile.base_notes.customdata, dims.bodyH, dims.bodyW, colorScales.Note);
    
    let scentCloudSelection;
    if (profile.main_accords.customdata && profile.main_accords.customdata.length > 0 && profile.main_accords.customdata[0].label !== 'N/A') {
        scentCloudSelection = createScentCloud(bottleGroup, profile.main_accords.customdata, colorScales, dims);
    }
    
    createBottleLabels(bottleGroup, dims);

    const attachHandlers = (selection) => {
        if (!selection) return;
        selection.on("mouseover", handleMouseOver).on("mousemove", handleMouseMove).on("mouseout", handleMouseOut);
    };

    attachHandlers(topNotesSelection);
    attachHandlers(middleNotesSelection);
    attachHandlers(baseNotesSelection);
    attachHandlers(scentCloudSelection);
}

async function loadAndProcessData(url) {
    const rawData = await d3.csv(url);
    return rawData.map(d => ({
        ...d,
        Brand: d.Brand ? String(d.Brand).trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : "Unknown Brand",
        Rating_Value: +d.Rating_Value || 0,
        Rating_Count: +d.Rating_Count || 0
    }));
}


function calculateIngredientStats(perfumes) {
    const stats = new Map();
    const ingredientData = new Map();
    const allIngredientColumns = ['Top_Notes', 'Middle_Notes', 'Base_Notes', 'Main_Accords'];
    const totalPerfumeCount = perfumes.length;
    
    perfumes.forEach(p => {
        const uniqueIngredients = new Set();
        allIngredientColumns.forEach(col => {
            (p[col] || '').toLowerCase().split(/,\s*/).forEach(item => {
                const trimmed = item.trim();
                if (trimmed && trimmed !== 'na') uniqueIngredients.add(trimmed);
            });
        });
        uniqueIngredients.forEach(ing => {
            if (!ingredientData.has(ing)) ingredientData.set(ing, []);
            ingredientData.get(ing).push(p);
        });
    });

    ingredientData.forEach((perfumeList, ingredient) => {
        if (perfumeList.length < MINIMUM_INGREDIENT_APPEARANCES) return;

        const brandRatingsMap = d3.rollup(perfumeList, v => v.map(p => p.Rating_Value), d => d.Brand);
        const processedBrandRatings = new Map();
        const brandAvgRatings = [];
        let globalTotalRating = 0;
        let globalCount = 0;

        brandRatingsMap.forEach((ratings, brand) => {
            const brandSum = d3.sum(ratings);
            processedBrandRatings.set(brand, brandSum / ratings.length);
            brandAvgRatings.push(brandSum / ratings.length);
            globalTotalRating += brandSum;
            globalCount += ratings.length;
        });
    });
    return stats;
}


function setupDropdown(brands, onBrandSelect) {
    d3.select("#brand-dropdown").selectAll("option").data(brands).enter()
        .append("option").text(d => d).attr("value", d => d);
    brandDropdown.addEventListener('change', (event) => onBrandSelect(event.target.value));
}


async function initializeApp() {
    try {
        const rawData = await d3.csv("parfumo_data.csv");
        df_original = rawData.map(d => ({
            ...d,
            Brand: d.Brand ? String(d.Brand).trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : "Unknown Brand",
            Rating_Value: +d.Rating_Value || 0,
            Rating_Count: +d.Rating_Count || 0
        }));

        const ratedDf = df_original.filter(p => p.Rating_Count >= MINIMUM_RATING_COUNT);
        const brandCountsInRatedDf = d3.rollup(ratedDf, v => v.length, d => d.Brand);
        const availableBrands = Array.from(brandCountsInRatedDf.keys())
            .filter(brand => brandCountsInRatedDf.get(brand) >= MINIMUM_PERFUMES_PER_BRAND && brand !== "Unknown Brand")
            .sort();

        const ingredientData = new Map();
        const allIngredientColumns = ['Top_Notes', 'Middle_Notes', 'Base_Notes', 'Main_Accords'];
        ratedDf.forEach(p => {
            const uniqueIngredients = new Set();
            allIngredientColumns.forEach(col => {
                (p[col] || '').toLowerCase().split(/,\s*/).forEach(item => {
                    const trimmed = item.trim();
                    if (trimmed && trimmed !== 'na') uniqueIngredients.add(trimmed);
                });
            });
            uniqueIngredients.forEach(ing => {
                if (!ingredientData.has(ing)) ingredientData.set(ing, []);
                ingredientData.get(ing).push(p);
            });
        });

        ingredientStats.clear();
        ingredientData.forEach((perfumes, ingredient) => {
            if (perfumes.length < MINIMUM_INGREDIENT_APPEARANCES) return;

            const brandRatingsMap = new Map();
            perfumes.forEach(p => {
                if (!brandRatingsMap.has(p.Brand)) brandRatingsMap.set(p.Brand, []);
                brandRatingsMap.get(p.Brand).push(p.Rating_Value);
            });

            const allRatings = perfumes.map(p => p.Rating_Value);
            const brandAvgRatings = [];
            const processedBrandRatings = new Map();
            brandRatingsMap.forEach((ratings, brand) => {
                const brandAvg = d3.mean(ratings);
                brandAvgRatings.push(brandAvg);
                processedBrandRatings.set(brand, brandAvg);
            });
            
            ingredientStats.set(ingredient, {
                globalAvgRating: d3.mean(allRatings),
                ratingStDev: d3.deviation(allRatings),
                brandRatings: processedBrandRatings,
                sortedBrandAvgRatings: brandAvgRatings.sort((a, b) => a - b)
            });
        });
        
        d3.select("#brand-dropdown")
            .selectAll("option")
            .data(availableBrands)
            .enter()
            .append("option")
            .text(d => d)
            .attr("value", d => d);

        brandDropdown.addEventListener('change', (event) => drawPerfumeDna(event.target.value));

        if (availableBrands.length > 0) {
            brandDropdown.value = availableBrands[0];
            drawPerfumeDna(availableBrands[0]);
        } else {
            d3.select("#brand-dropdown").style("display", "none");
            vizContainer.append("p").text("No brands meet the required data quality standards, namely at least 10 perfumes with 100+ ratings each");
        }
    } catch (error) {
        console.error("error loading or processing data:", error);
        vizContainer.append("p").text("Error: could not load data. please check the file path and console for details");
    }
}

initializeApp();