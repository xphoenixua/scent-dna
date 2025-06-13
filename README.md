# Intro

An interactive data visualization that deconstructs the scent profiles of perfume brands. It displays the structure of a brand's fragrances as a "bottle" and its main accords as a surrounding "scent cloud".

**[Live Demo](https://xphoenixua.github.io/scent-dna/)**

## Concepts

*   **the bottle** is a stacked bar chart representing the most common Top, Middle, and Base notes for the selected brand. Each segment's size corresponds to its share within that category.
*   **the scent cloud** around it is a bubble chart where each bubble is a Main Accord. The size of the bubble represents its prominence in the brand's scent profile.

## Data filtering

We filter the data to ensure all insights are based on substantial information:
*   visualization only includes brands with at least 10 perfumes.
*   we only use perfumes that have received at least 100 user ratings
*   an ingredient must appear in at least 100 of these well-rated perfumes

## Interactive tooltips

Hovering over any note or accord reveals a tooltip with several data points:
*   **share** shows an ingredient's proportion within its specific category, like Top Notes, for that brand.
*   **usage percentage** indicates how prevalent an ingredient is across the brand's entire product line.
*   **percentile rank** compares the brand's use of an ingredient against all other qualifying brands.
*   **polarity score** measures rating consistency, where a divisive note indicates high rating variance and a consistent favorite shows low variance.


## Technology

*   HTML5
*   CSS3
*   D3.js (v7)
