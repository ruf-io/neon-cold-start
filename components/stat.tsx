interface Props {
    title: string;
    stat?: string | number;
    help?: string;
    desc?: string;
    showTimer?: boolean;
}

export const formatFloatToStatString = (float?: number) => {
    return float ? `${Math.round(float)}` : "-";
}

const Stat = (props: Props) => {
    const { stat, title, help, desc, showTimer=false } = props;

    return (
        <div
            className="stat"
        >
            {showTimer && (
            <div className="stat-figure text-primary">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="inline-block w-8 h-8 stroke-current"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
            </div>)}
            <h3 className="stat-title" >
                {title}
                {help && (<span className="tooltip translate-x-1 translate-y-1" data-tip={help}><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></span>)}
            </h3>
            <p className="stat-value">{stat}</p>
            <div className="stat-desc">{desc}</div>
        </div>
    )
}

export default Stat;