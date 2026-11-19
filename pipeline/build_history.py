"""Curated, verified historical records + modern commute stories -> static JSON for the app.

Every record below was checked against the cited source on ACCESSED (see each source's `accessed`).
Endpoints are placed at documented stations where the source names them, otherwise at the 2011 census
area's representative point with precision "area" (the evidence only establishes a broad area).
"""
import json, sys
from pathlib import Path

OUT = Path(sys.argv[1])
ACC = "2026-11-19"
areas = {a["census_name"]: a for a in json.loads((OUT / "areas_2011.json").read_text())["areas"]}

def area(name, place=None, original=None, note=None):
    a = areas[name]
    return dict(place=place or a["name"], original=original, lon=a["lon"], lat=a["lat"], precision="area",
                note=note or "Marker at the 2011 census area's representative point; the source names only the town or area.")

def pt(place, lon, lat, precision="exact", original=None, note=None):
    return dict(place=place, original=original, lon=lon, lat=lat, precision=precision, note=note)

def unknown(place, note):
    return dict(place=place, precision="unknown", note=note)

def src(title, url, **kw):
    return dict(title=title, url=url, accessed=ACC, **kw)

PARL_1893 = src("House of Commons debate: Overcrowded workmen's trains", "https://api.parliament.uk/historic-hansard/commons/1893/mar/16/overcrowded-workmens-trains",
                institution="UK Parliament, Historic Hansard", published="16 March 1893", ref="HC Deb 16 March 1893 vol 10 c236")
VOB_1921 = src("1921 Census of England and Wales, General Report with Appendices, Part XI: Workplaces", "https://www.visionofbritain.org.uk/census/EW1921GEN/12",
               institution="General Register Office (HMSO); transcription by A Vision of Britain through Time, University of Portsmouth", ref="Part XI, Workplaces; Tables XC–XCII")
HANSARD_1925 = src("House of Commons: Railways and Tramways (Workmen's Tickets)", "https://hansard.parliament.uk/Commons/1925-02-17/debates/f48f58cd-ce4c-4766-b3b9-c44a5dbe6915/RailwaysAndTramways%28WorkmenSTickets%29",
                   institution="UK Parliament, Hansard", published="17 February 1925", ref="HC Deb 17 February 1925 vol 180")
POOLEY_2016 = src("Mobility, transport and social inclusion: lessons from history", "https://cogitatiopress.com/socialinclusion/article/download/461/352",
                  author="Colin Pooley", institution="Social Inclusion 4(3), 100–109, doi:10.17645/si.v4i3.461", published="7 June 2016",
                  ref="Oral history interviews from a Leverhulme Trust project on the journey to work in twentieth-century Britain (1996–99)")
POOLEY_WALK = src("Walking spaces: changing pedestrian practices in Britain since c1850 (author's accepted manuscript)", "https://eprints.lancs.ac.uk/145653/1/Walking_spaces_paper_JTH_3_final_.pdf",
                  author="Colin G. Pooley", institution="Lancaster University EPrints 145653", published="2020", ref="Diary of 'B' (author's copy), entries 19 Jan 1954, 15 Apr 1954, 18 Mar 1968")

records = [
    dict(id="h01", layer="journey", title="A child mill worker's two-mile walk in the dark", person="Elizabeth Bentley",
         occupation="Doffer in a flax mill, from the age of six", start=1832, end=1832,
         dateLabel="Described in evidence given in 1832 (about earlier years; the exact years are not given in this transcript)",
         mode="Not stated (no transport is mentioned)", region="Leeds, Yorkshire",
         origin=unknown("Home, about two miles from the mill", "The testimony gives a distance, not an address."),
         destination=area("Leeds", place="Flax mill, Leeds (Hunslet)", original="the mill; 'Hunslet Car' is named",
                           note="Hunslet is named in the testimony; the mill's site isn't given in this transcript. Marker at Leeds' representative point."),
         account="Giving evidence in 1832, Bentley said she started work as a little doffer at six, lived two miles from the mill and her family had no clock. "
                 "Her mother got up around 4 a.m. to make sure she was on time. She described waiting at Hunslet Car at 2 a.m. in the rain until the mill opened, "
                 "and said that a quarter of an hour's lateness cost half an hour's pay.",
         quote="Did you live far from the mill? — Yes, two miles.",
         sources=[src("Testimony before the Sadler Committee, 1832 (transcribed extract)", "https://digfir-published.macmillanusa.com/mckaysources/mckaysources_ch23_5.html",
                      institution="Select Committee on the Factories Bill (Sadler Committee), British Parliamentary Papers 1831–32; extract published by Macmillan Learning", published="1832")],
         caveats="Evidence collected by a committee campaigning to limit children's hours. It describes one witness's experience, not a measured commute."),
    dict(id="h02", layer="journey", title="Workmen's trains into Liverpool Street before dawn", person="Workers using Great Eastern Railway workmen's trains (a group, not individuals)",
         occupation="Workmen (not further specified)", start=1893, end=1893, dateLabel="Service described in Parliament on 16 March 1893",
         mode="Workmen's trains (cheap early-morning fares)", region="London",
         origin=pt("Enfield Town station", -0.0792, 51.6516, "approximate", original="Enfield or Lower Edmonton",
                   note="Trains came from Enfield or Lower Edmonton; the marker is at Enfield Town station (Wikipedia coordinates)."),
         destination=pt("Liverpool Street station", -0.0813, 51.5186, "exact", original="Liverpool Street"),
         account="Asked about overcrowding on Great Eastern workmen's trains between Enfield and London, the President of the Board of Trade, A. J. Mundella, said that 13 trains "
                 "arrived at Liverpool Street from Enfield or Lower Edmonton between 4.40 a.m. and 7.50 a.m. Eight were 2d. trains and five were half-fare trains, "
                 "and some trains were more popular, and more crowded, than others.",
         quote="13 trains arrive at Liverpool Street from either Enfield or Lower Edmonton",
         sources=[PARL_1893], caveats="Counts trains, not passengers. The question was asked by Captain Henry Bowles, MP for Enfield.",
         modern=dict(origin="Enfield Town station", destination="Liverpool Street station", note="Both stations are still open, so the modern comparison uses the same two stations.")),
    dict(id="h03", layer="statistic", title="The City of London: 13,709 by night, 436,721 by day", person="People enumerated in, or working in, the City of London",
         start=1921, end=1921, dateLabel="Census day, 19 June 1921", region="London", count=436721,
         origin=pt("City of London", -0.0869, 51.5103, "area", note="Marker placed in the City; the figures cover the whole City."),
         destination=pt("City of London", -0.0869, 51.5103, "area"),
         account="The 1921 Census was the first in England and Wales to ask for each worker's place of work. The General Report describes the City of London as almost completely non-residential: "
                 "a night (enumerated) population of 13,709 and a day population of 436,721, more than thirty times as large. It estimates that central London gained "
                 "rather more than 800,000 people during the day, about half of them going to the City.",
         quote="more than thirty times as large day population of 436,721",
         sources=[VOB_1921],
         caveats="Day population counts people with 'no fixed workplace' or no stated workplace as working where they were enumerated, and excludes shoppers and visitors. "
                 "The census was postponed to 19 June 1921, when some people were away on holiday, and unemployed people were asked for their last workplace."),
    dict(id="h04", layer="statistic", title="Westminster's day population: 385,984", person="People working in the Metropolitan Borough of Westminster",
         start=1921, end=1921, dateLabel="Census day, 19 June 1921", region="London", count=385984,
         origin=area("Westminster,City of London", place="Westminster", original="Metropolitan Borough of Westminster",
                     note="Marker at the representative point of the 2011 Westminster & City census area; the 1921 borough boundary differed."),
         destination=area("Westminster,City of London", place="Westminster", original="Metropolitan Borough of Westminster",
                          note="Marker at the representative point of the 2011 Westminster & City census area; the 1921 borough boundary differed."),
         account="Of London's 28 metropolitan boroughs, Westminster had the largest day population in 1921 (385,984), although it ranked only 15th by the number of people enumerated there.",
         sources=[VOB_1921], caveats="Same definitions and caveats as the City of London figure. 1921 boroughs aren't the same as today's local authorities."),
    dict(id="h05", layer="journey", title="Early workmen's fares and an hour's wait before work", person="Workers using workmen's trams and trains into central London (a group)",
         start=1925, end=1925, dateLabel="Raised in Parliament on 17 February 1925", mode="Workmen's trams and trains", region="London",
         origin=unknown("Not specified", "The question doesn't name where the workers came from."),
         destination=pt("Central London", -0.0869, 51.5103, "area", original="the central districts of London", note="Area marker only; no specific workplace is named."),
         account="Major Salmon MP said many workers who, for economic reasons, used cheap workmen's trams and trains to reach central London arrived early and often waited idle, sometimes in bad weather, "
                 "for up to an hour before starting work, because workmen's tickets were only issued until about 7.30 a.m. He asked for this to be extended to 8 a.m. "
                 "The Minister of Transport, Colonel Ashley, declined, citing the risk of congestion between 8 and 9 a.m.",
         quote="as much as an hour before commencing work",
         sources=[HANSARD_1925], caveats="A question in Parliament describing a general situation. It gives no counts."),
    dict(id="h06", layer="journey", title="'Travelling' underground: the unpaid walk to the coal face", person="Coal miners, as observed by George Orwell",
         occupation="Coal miners", start=1936, end=1936, dateLabel="Observed early 1936; published 1937",
         mode="On foot underground, stooping, after the cage ride down the shaft", frequency="Every shift, as Orwell describes it",
         duration="About 20 minutes a mile for an experienced miner; at least an hour a day in total, often two or three",
         durationKind="writer's estimate, not timed", region="Lancashire coalfield (Wigan)",
         origin=pt("Pit-shaft bottom", -2.6318, 53.5448, "area", note="Orwell based his mining research around Wigan. The chapter doesn't name the pits, so this is an area marker."),
         destination=pt("Coal face", -2.6318, 53.5448, "area"),
         account="Orwell describes the journey from the bottom of the shaft to the coal face. He says it was often a mile, three miles was fairly normal and in a few mines it was up to five, "
                 "walked bent double. Miners weren't paid for this 'travelling', which added at least an hour to the working day. "
                 "This is travel inside the workplace rather than a commute from home, but it shaped the length of a miner's working day.",
         quote="three miles is a fairly normal one",
         sources=[src("The Road to Wigan Pier, chapter 2 ('Down the Mine')", "https://terebess.hu/english/orwell/esszek/14.html", author="George Orwell",
                      institution="Victor Gollancz (Left Book Club); online text copy", published="1937")],
         caveats="A writer's description of mines he visited, not a survey."),
    dict(id="h07", layer="journey", title="Buying a car because the journey to work was awkward", person="Interviewee RJ39 (anonymised), male",
         start=1950, end=1959, dateLabel="1950s, as recalled in an oral history interview (project 1996–99)", mode="Car, bought for the journey to work",
         region="Glasgow",
         origin=unknown("Not given", "Home and workplace are anonymised in the published extract."),
         destination=area("Glasgow City", place="Glasgow (area of interview)", note="The interview is attributed to Glasgow; the workplace ('x') is anonymised."),
         account="In an oral history interview, a Glasgow man said he got a car in the 1950s because travelling to his workplace was awkward.",
         quote="to travel to x was quite awkward",
         sources=[POOLEY_2016], caveats="A single recollection recorded decades later."),
    dict(id="h08", layer="journey", title="Bus, then bicycle, then car: one woman's journeys to work", person="Diarist 'B' (anonymised), born 1928",
         occupation="Worked on a chicken farm, then for an agricultural merchant from 1956", start=1954, end=1968,
         dateLabel="Diary entries 1954–1968", mode="Walk and bus (1954); mostly bicycle (from about 1958); car (from 1964)",
         region="England (places anonymised in the source)",
         origin=unknown("Home (anonymised)", "Place names are anonymised in the published research, so this record isn't placed on the map."),
         destination=unknown("Workplace 'W' (anonymised)", "Anonymised in the source."),
         account="In 1954 B's diary records catching the 7.45 bus to work, and walking to a bus stop for another bus. From about 1958 she mostly cycled. "
                 "From 1964 she drove the roughly 3 km to work. On 18 March 1968 she had to cycle because the car had a flat tyre.",
         quote="I walked to NH for 5 to 10 bus",
         sources=[POOLEY_WALK], caveats="One diary. The researcher anonymised places, so the journey can't be mapped."),
    dict(id="h09", layer="journey", title="An eight-minute drive, or two buses", person="Interviewee RJ92 (anonymised), male",
         start=1990, end=1999, dateLabel="1990s, as described in an oral history interview", mode="Car; by public transport it would take two buses",
         duration="Eight minutes by car", durationKind="self-reported", region="London",
         origin=unknown("Not given", "Anonymised."), destination=area("Westminster,City of London", place="London (area of interview)", note="The interview is attributed to London; the locations aren't given."),
         account="A London interviewee explained driving a short journey to work because doing it by public transport would need two buses.",
         quote="my little eight-minute journey, to do it by public transport would be two buses",
         sources=[POOLEY_2016], caveats="A single recollection."),
]

# Modern first-person accounts (also shown in the 2011 map's "People making this journey")
STORIES = [
    dict(id="s01", platform="British Cycling", url="https://www.britishcycling.org.uk/article/trav20121129-We-are-British-Cycling---we-are-bike-commuters---Dave-Bryce-0",
         author="Dave Bryce", published="2012 (page URL dated 29 Nov 2012; no date shown on the page)", origin_text="Bolton", destination_text="HMRC, Salford",
         origin="Bolton", destination="Salford", mode="Bicycle, partly off-road", duration=None, duration_kind=None,
         summary="Cycles about 12 miles each way from Bolton to work at HMRC in Salford, usually two days out of a four-day week. He says it takes as long as the bus.", year=2012),
    dict(id="s02", platform="Londonist", url="https://londonist.com/london/transport/what-s-your-commute-tonbridge-to-cannon-street",
         author="Laura (first name only)", published="last updated 10 July 2018", origin_text="Tonbridge", destination_text="Office near Old Street, London (via Cannon Street)",
         origin="Tonbridge and Malling", destination=None, mode="Walk, Southeastern train to Cannon Street, walk", duration="Just under two hours each way", duration_kind="door to door, self-reported",
         summary="Walks about half an hour to Tonbridge station, takes a 45-minute train (station to station) to Cannon Street, then walks about 25 minutes. Works from home a couple of days a week.", year=2018,
         note="Old Street sits on the Islington–Hackney boundary, so this story isn't linked to one destination area."),
    dict(id="s03", platform="Londonist", url="https://londonist.com/london/transport/what-s-your-commute-surbiton-to-waterloo",
         author="Paul (first name only)", published="last updated 20 July 2018", origin_text="Surbiton", destination_text="Office near Charing Cross, London (via Waterloo)",
         origin="Kingston upon Thames", destination="Westminster,City of London", mode="Train to Waterloo, walk across Hungerford Bridge", duration="One hour most days", duration_kind="door to door, self-reported",
         summary="Takes the train from Surbiton to Waterloo and walks across Hungerford Bridge to an office near Charing Cross. About an hour door to door most days, more when things go wrong.", year=2018),
    dict(id="s04", platform="Londonist", url="https://londonist.com/london/transport/what-s-your-commute-romford-to-tring",
         author="Morgan (first name only)", published="last updated 18 July 2018", origin_text="Romford", destination_text="Tring",
         origin="Havering", destination="Dacorum", mode="Lift to the station, TfL Rail, Underground, London Northwestern train, then bus, taxi or walk",
         duration="Two hours at best; plans for two and a half", duration_kind="door to door, self-reported",
         summary="A dance teacher who travels from Romford to work in Tring three times a week, crossing London via Liverpool Street and Euston.", year=2018),
    dict(id="s05", platform="The Scotsman", url="https://www.scotsman.com/news/politics/perth-to-edinburgh-commute-quicker-in-victorian-times-scotrail-peak-fares-4769290",
         author="Rachel Amery (named in The Scotsman's accompanying video)", published="2024 (exact date not shown)", origin_text="Home in Perth", destination_text="Scottish Parliament, Holyrood, Edinburgh",
         origin="Perth and Kinross", destination="City of Edinburgh", mode="Train (7am service with 14 stops via Fife)", duration="Two hours 20 minutes", duration_kind="door to door, self-reported",
         summary="A political journalist's commute from Perth to Holyrood: about 45 miles. She notes the faster direct line via Kinross closed in 1970.", year=2024),
]

stories, story_records = [], []
for s in STORIES:
    o, d = s["origin"], s["destination"]
    stories.append(dict(id=s["id"], platform=s["platform"], url=s["url"], author=s["author"], published=s["published"], checked=ACC,
                        origin_text=s["origin_text"], destination_text=s["destination_text"],
                        origin_code=areas[o]["code"] if o else None, destination_code=areas[d]["code"] if d else None,
                        mode=s["mode"], duration=s["duration"], duration_kind=s["duration_kind"], summary=s["summary"], note=s.get("note")))
    story_records.append(dict(id="m" + s["id"][1:], layer="journey", title=f"{s['origin_text']} → {s['destination_text']}", person=s["author"],
                              start=s["year"], end=s["year"], dateLabel=f"Described in {s['year']}", mode=s["mode"], duration=s["duration"], durationKind=s["duration_kind"],
                              region=areas[o]["nation"], origin=area(o, place=s["origin_text"]),
                              destination=area(d, place=s["destination_text"]) if d else pt(s["destination_text"], -0.0878, 51.5257, "approximate", note="Old Street area (Wikipedia coordinates for Old Street station); the exact office isn't given."),
                              account=s["summary"], sources=[src(f"{s['platform']}: {s['author']}", s["url"], published=s["published"])],
                              modern=dict(origin=s["origin_text"].replace("Home in ", ""), destination=s["destination_text"].split(" (")[0],
                                          note="Uses the place names stated by the author, not their actual home or workplace."),
                              caveats="A self-reported anecdote, not a representative statistic."))
records += story_records

def line(id, name, kind, opened, openedYear, stations, sources, closed=None, closedYear=None, note=None, loop=False):
    path = [[s["lon"], s["lat"]] for s in stations] + ([[stations[0]["lon"], stations[0]["lat"]]] if loop else [])
    lbl = f"opened {opened}" + (f", closed {closed}" if closed else "")
    return dict(id=id, name=name, kind=kind, opened=opened, openedYear=openedYear, closed=closed, closedYear=closedYear, dateLabel=lbl,
                stations=stations, path=path, note=note, sources=sources)

S = lambda name, lon, lat: dict(name=name, lon=lon, lat=lat)
WIKI = lambda t: src(f"Wikipedia: {t.replace('_', ' ')}", f"https://en.wikipedia.org/wiki/{t}", institution="Wikipedia (dates and station coordinates, with the article's cited sources)")
infra = [
    line("i01", "Oystermouth (Swansea and Mumbles) Railway", "tramway", "25 March 1807", 1807,
         [S("Swansea (Brewery Bank, approximate)", -3.95, 51.61667), S("Oystermouth (Castle Hill)", -4.00297, 51.57645)],
         [src("The Mumbles Railway", "https://www.peoplescollection.wales/content/mumbles-railway", institution="People's Collection Wales"),
          src("Swansea and Mumbles Railway", "https://gracesguide.co.uk/Swansea_and_Mumbles_Railway", institution="Grace's Guide to British Industrial History")],
         closed="5 January 1960", closedYear=1960, note="Horse-drawn at first: the first regular fare-paying passenger service. Steam from 1877, electric trams from 1929. Swansea end placed at the city centre (approximate)."),
    line("i02", "Liverpool and Manchester Railway", "railway", "15 September 1830", 1830,
         [S("Liverpool Crown Street", -2.9572, 53.40037), S("Manchester Liverpool Road", -2.25556, 53.47694)],
         [WIKI("Liverpool_and_Manchester_Railway"), WIKI("Crown_Street_railway_station")],
         note="Original termini. Crown Street was soon replaced by Lime Street; the route remains in use."),
    line("i03", "Belfast and County Down Railway: Belfast–Holywood", "railway", "2 August 1848", 1848,
         [S("Belfast Queen's Quay", -5.9174, 54.6016), S("Holywood", -5.8395, 54.6411)],
         [src("Belfast & County Down Railway", "https://www.downrail.co.uk/about/bcdr/", institution="Downpatrick & County Down Railway"), WIKI("Holywood_railway_station_(Northern_Ireland)")],
         note="The first section of the BCDR. Extended to Bangor in 1865 by another company."),
    line("i04", "Metropolitan Railway: Paddington–Farringdon", "underground", "10 January 1863", 1863,
         [S("Paddington (Bishop's Road)", -0.1785, 51.5186), S("Farringdon Street", -0.105, 51.52056)],
         [WIKI("Metropolitan_Railway")], note="The world's first passenger underground railway. Workmen's trains followed."),
    line("i05", "Mersey Railway: Liverpool–Birkenhead", "railway", "1886", 1886,
         [S("Liverpool James Street", -2.9919, 53.4048), S("Birkenhead Green Lane", -3.016, 53.383)],
         [WIKI("Mersey_Railway")], note="Under the Mersey by tunnel. The year comes from the cited article, which gives no day."),
    line("i06", "City and South London Railway", "underground", "1890", 1890,
         [S("Stockwell", -0.122, 51.4725), S("King William Street", -0.08694, 51.51028)],
         [WIKI("City_and_South_London_Railway")], note="The first deep-level electric tube line."),
    line("i07", "Glasgow District Subway", "underground", "14 December 1896", 1896,
         [S("St Enoch", -4.25583, 55.85694), S("Buchanan Street", -4.25341, 55.86246), S("St George's Cross", -4.26972, 55.87194), S("Hillhead", -4.29222, 55.87583),
          S("Partick", -4.3092, 55.8698), S("Govan", -4.31056, 55.86222), S("Ibrox", -4.30528, 55.85444), S("Bridge Street", -4.25861, 55.85167)],
         [src("Celebrating 125 years of Subway", "https://spt.co.uk/125", institution="Strathclyde Partnership for Transport"), WIKI("Glasgow_Subway")],
         note="A circular line, drawn through 8 of its 15 stations.", loop=True),
    line("i08", "Tyne and Wear Metro (first phase)", "railway", "11 August 1980", 1980,
         [S("Haymarket", -1.6139, 54.9775), S("Tynemouth", -1.42887, 55.01705)],
         [WIKI("Haymarket_Metro_station")], note="The first section ran between Haymarket and Tynemouth via Four Lane Ends."),
    line("i09", "Elizabeth line (central section)", "railway", "24 May 2022", 2022,
         [S("Paddington", -0.1774, 51.5173), S("Abbey Wood", 0.1214, 51.491)],
         [WIKI("Elizabeth_line")], note="Passenger services began on 24 May 2022."),
]

snapshots = [
    dict(id="c1921", year=1921, date="1921-06-19", label="1921 Census workplace statistics (England and Wales)", coverage="England and Wales; borough and district level",
         inApp=False, note="The first census to ask for each worker's place of work (England and Wales). Its flow tables were printed in the Workplaces volume. They aren't digitised here, "
                          "so the map shows only the two headline figures quoted in the General Report.", sources=[VOB_1921]),
    dict(id="c2011", year=2011, date="2011-03-27", label="2011 Census (27 March 2011)", coverage="all four UK nations, 404 local authority areas", inApp=True,
         note="Full origin–destination table WU03UK, by method of travel.",
         sources=[src("WU03UK", "https://www.nomisweb.co.uk/census/2011/wu03uk", institution="ONS, NRS and NISRA via Nomis")]),
]

coverage = [
    dict(period="1800–1829", statistical="None", journeys="None verified yet", infrastructure="Oystermouth (Swansea and Mumbles) Railway, 1807"),
    dict(period="1830–1849", statistical="None (no workplace question before 1921)", journeys="Mill worker's testimony, 1832 (Leeds)", infrastructure="Liverpool and Manchester, 1830; Belfast–Holywood, 1848"),
    dict(period="1850–1899", statistical="None", journeys="Workmen's trains to Liverpool Street, 1893", infrastructure="Metropolitan, 1863; Mersey, 1886; City & South London, 1890; Glasgow Subway, 1896"),
    dict(period="1900–1949", statistical="1921 Census: two headline workplace figures (E&W only)", journeys="Workmen's fares, 1925 (London); miners' underground 'travelling', 1936", infrastructure="—"),
    dict(period="1950–1999", statistical="Not loaded: later census workplace tables exist (1951–2001) but aren't included", journeys="Glasgow 1950s; diarist B 1954–68; London 1990s", infrastructure="Tyne and Wear Metro, 1980"),
    dict(period="2000–2010", statistical="Not loaded (2001 Census flows exist)", journeys="None verified yet", infrastructure="—"),
    dict(period="2011", statistical="Full UK flow table, all four nations (drawn on the map)", journeys="—", infrastructure="—"),
    dict(period="2012–now", statistical="No newer UK-wide table loaded. 2021 (E&W, NI) and 2022 (Scotland) differ in date and were affected by the pandemic",
         journeys="Self-reported commutes, 2012, 2018 (three) and 2024", infrastructure="Elizabeth line, 2022"),
    dict(period="Gaps", statistical="—", journeys="No verified individual journeys yet for Wales or Northern Ireland, or before 1832", infrastructure="Only a small sample of lines; many more opened and closed"),
]

(OUT / "history.json").write_text(json.dumps(dict(generated=ACC, records=records, infrastructure=infra, snapshots=snapshots, coverage=coverage), ensure_ascii=False, indent=1))
(OUT / "stories.json").write_text(json.dumps(dict(stories=stories), ensure_ascii=False, indent=1))
# validation
ids = [r["id"] for r in records]
assert len(ids) == len(set(ids)) and all(r["start"] <= r["end"] for r in records)
assert all(x["openedYear"] <= (x["closedYear"] or 9999) for x in infra)
for r in records:
    for s in r["sources"]:
        assert s["url"].startswith("https://"), r["id"]
    if r.get("quote"):
        assert len(r["quote"].split()) < 15, (r["id"], len(r["quote"].split()))
print(len(records), "records,", len(infra), "infrastructure items,", len(stories), "stories")
