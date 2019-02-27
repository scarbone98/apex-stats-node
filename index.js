const request = require('request');
const cheerio = require('cheerio');
const express = require('express');
const app = express();
const port = process.env.PORT || 8000;
const cors = require('cors');
const _ = require('lodash');
app.use(cors());

app.get('/leaderboard', (req, res) => {
    const {page} = req.query || 1;
    const {platform} = req.query || 'all';
    const {stat} = req.query || 'Kills';
    const {legend} = `&legend=${req.query}` || '';
    request(`https://apex.tracker.gg/apex/leaderboards/${platform}/${stat}?page=${page}${legend}`, function (error, response, html) {
        if (response && response.statusCode === 200) {
            const $ = cheerio.load(html);
            let data = [];
            $('tbody').find('tr').each((i, el) => {
                let obj = {};
                $(el).find('td').each((index, col) => {
                    if (index === 0) {
                        obj.rank = $(col).text();
                    } else if (index === 1) {
                        obj.name = cleanData($(col).text());
                        const console = $(el).find('i').attr('class');
                        const socials = [];
                        $(el).find('a').each((i, social) => {
                            socials.push($(social).attr('href'));
                        });
                        socials.shift();
                        obj.socials = socials;
                        if (console.indexOf('windows') >= 0) {
                            obj.console = 'pc';
                        } else if (console.indexOf('xbox') >= 0) {
                            obj.console = 'xbox';
                        } else if (console.indexOf('playstation') >= 0) {
                            obj.console = 'playstation';
                        }
                    } else if (index === 2) {
                        obj.kills = $(col).text();
                    }
                });
                data.push(obj);
            });
            res.status(200).send(data);
        } else {
            console.log(error);
        }

    });
});

app.get('/player', (req, res) => {
    let {name, console} = req.query;
    playerStats(console, name)
        .then(resp => res.status(200).send(resp))
        .catch(e => res.status(500).send(e))
});


app.get('/search', (req, res) => {
    let {name} = req.query;
    return Promise.all([playerStats('xbox', name), playerStats('playstation', name), playerStats('pc', name)])
        .then(values => res.status(200).send(values.filter(el => el !== null)))
        .catch(e => res.status(500).send(e))
});

app.get('/news', (req, res) => {
    request('https://apex.tracker.gg/', (error, response, html) => {
        if (response && response.statusCode === 200) {
            const result = [];
            const $ = cheerio.load(html);
            $('article').each((index, article) => {
                const obj = {};
                obj.imageURL = $(article).find('img').attr('src');
                obj.title = cleanData($(article).find('h2').text());
                obj.preview = cleanData($(article).find('p').text());
                obj.readMoreLink = 'https://apex.tracker.gg' + $(article).find('div.trn-article__actions').find('a').first().attr('href');
                result.push(obj);
            });
            res.status(200).send(result);
        } else {
            res.status(500).send(error);
        }
    });
});


app.get('/matches', (req, res) => {
    const {platform, name} = req.query;
    request(`https://apex.tracker.gg/profile/${platform}/${name}`, (error, response, html) => {
        if (response && response.statusCode === 200) {
            const result = [];
            const $ = cheerio.load(html);
            $('div.trn-card.trn-card--dark.ap-match').each((i, match) => {
                let obj = {};
                let title = cleanData($(match).find('span.ap-match__title').text()).split("-");
                obj.name = title[0].trim();
                const times = title[1].trim().split(" ");
                obj.time = {
                    date: times[0],
                    hour: `${times[1]}${times[2]}`
                };
                let stats = {};
                $(match).find('div.trn-defstat').each((_, stat) => {
                    let key = null;
                    $(stat).find('div').each((i3, label) => {
                        if (i3 === 0) {
                            key = cleanData($(label).text()).toLowerCase();
                        } else if (i3 === 1) {
                            stats[key] = cleanData($(label).text());
                        }
                    });
                });
                obj.stats = stats;
                result.push(obj);
            });
            res.status(200).send(result);
        } else {
            res.status(500).send(error);
        }
    });
});


app.get('/gunStats', (req, res) => {
    request(`https://rankedboost.com/apex-legends/best-weapons-tier-list/`, (error, response, html) => {
        if (response && response.statusCode === 200) {
            const result = [];
            const $ = cheerio.load(html);
            const titles = [];
            $('th').each((i, el) => {
               titles.push(cleanData($(el).text()).toLowerCase());
            });
            titles[0] = 'name';
            $('tr').each((i, el) => {
                let obj = {};
                $(el).find('td').each((index, col) => {
                    obj[titles[index]] = cleanData($(col).text());
                });
                if(!_.isEmpty(obj)) {
                    result.push(obj);
                }
            });
            res.status(200).send(result);
        } else {
            res.status(500).send(error);
        }
    });
});

function playerStats(platform, name) {
    platform = platform === 'xbox' ? 'xbl' : platform === 'playstation' ? 'psn' : platform;
    return new Promise((resolve, reject) => {
        request(`https://apex.tracker.gg/profile/${platform}/${name}`, (error, response, html) => {
            if (response && response.statusCode === 200) {
                const $ = cheerio.load(html);


                /* TODO need to somehow wait before we parse this part */

                let result = {name: name, platform: platform};
                let legendsData = [];
                let lifetime = {};

                let socials = [];

                $('div.trn-profile-header__action.trn-profile-header__action-left').find('a').each((i, el) => {
                    socials.push($(el).attr('href'));
                });

                result.socials = socials;
                result.profileImage = $('div.trn-profile-header__avatar').find('img').attr('src');
                $('div.trn-card__content').find('div.trn-defstat.trn-defstat--large').each((i, el) => {
                    let key = null;
                    let stat = {};
                    $(el).children('div').each((i2, child) => {
                        if (i2 === 0) {
                            key = cleanData($(child).text());
                        } else if (i2 === 1) {
                            stat.value = cleanData($(child).text());
                        } else if (i2 === 2) {
                            stat.rank = cleanData($(child).text());
                        }
                    });
                    lifetime[key.toLowerCase()] = stat;
                });
                result.lifetime = lifetime;


                $('div.trn-card').find('div.ap-legend-stats').each((i, el) => {
                    let obj = {};
                    $(el).siblings('div').each((i1, header) => {
                        obj['name'] = cleanData($(header).find('h2').text());
                    });
                    $(el).find('div.trn-defstat').each((i2, stats) => {
                        let key = null;
                        $(stats).find('div').each((i3, data) => {
                            if (i3 === 0) {
                                key = cleanData($(data).text()).toLowerCase();
                            } else if (i3 === 1) {
                                obj[key] = cleanData($(data).text());
                            } else if (i3 === 2) {
                                obj.rank = cleanData($(data).text());
                            }
                        });
                    });
                    legendsData.push(obj);
                });
                result.legends = legendsData;
                if (legendsData.length === 0) {
                    resolve(null);
                } else {
                    resolve(result);
                }
            } else {
                reject(error);
            }
        });
    })
}

function cleanData(data) {
    return data.replace(/\n/g, "").trim();
}

app.listen(port, () => console.log(`Listening on port: ${port}`));