const request = require('request');
const cheerio = require('cheerio');
const express = require('express');
const app = express();
const port = process.env.PORT || 8000;


app.get('/leaderboard', (req, res) => {
    const {page} = req.query || 1;
    request(`https://apex.tracker.gg/apex/leaderboards/origin/Kills?page=${page}`, function (error, response, html) {
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
    const {name, console} = req.query;
    request(`https://apex.tracker.gg/profile/${console}/${name}`, (error, response, html) => {
        if (response && response.statusCode === 200) {
            const $ = cheerio.load(html);


            /* TODO need to somehow wait before we parse this part */

            let result = {};
            let legendsData = [];
            let lifetime = {};
            $('div.trn-card__content').find('div.trn-defstat.trn-defstat--large').each((i, el) => {
                let key = null;
                let stat = {};
                $(el).children('div').each((i2, child) =>{
                    if (i2 === 0) {
                        key = cleanData($(child).text());
                    } else if(i2 === 1) {
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
                    obj['name'] = cleanData($(header).text());
                });
                $(el).find('div.trn-defstat').each((i2, stats) => {
                    let key = null;
                    $(stats).find('div').each((i3, data) => {
                       if(i3 === 0) {
                           key = cleanData($(data).text()).toLowerCase();
                       } else if(i3 === 1) {
                           obj[key] = cleanData($(data).text());
                       } else if(i3 === 2) {
                           obj.rank = cleanData($(data).text());
                       }
                    });
                });
                legendsData.push(obj);
            });
            result.legends = legendsData;
            res.status(200).send(result);



        } else {
            res.status(500).send(error);
        }
    });
});


function cleanData(data) {
    return data.replace(/\n/g, "").trim();
}

app.listen(port, () => console.log(`Listening on port: ${port}`));