import supabase from "./client.js"

export const getSchedule = async (establishmentId: string): Promise<ScheduleWithEstablishment[] | null> => {
    try {
        const { data, error, status } = await supabase
            .from('days')
            .select(`
                id_day,
                name,
                is_open,
                session_schedule (      
                    id_session,
                    opening_time,
                    closing_time
                )
            `)
            .eq('id_establishment', establishmentId)
            .order('name')

        if (error && status !== 406) {
            console.error('Database error:', error)
            throw new Error(`Failed to fetch schedule: ${error.message}`)
        }

        return data as ScheduleWithEstablishment[]

    } catch (error) {
        console.error('Error loading schedule data:', error)
        throw error // ✅ Re-throw the error
    }
}

export const getProductsWithEstablishment = async (establishmentId: string): Promise<Products[]> => {
    console.log('🟡 Loading products data...') // Solo la primera vez

    try {
        const { data, error, status } = await supabase
            .from('products')
            .select(`
                *
            `)
            .eq('id_establishment', establishmentId)
            .order('name')

        if (error && status !== 406) {
            console.error('Database error:', error)
            throw new Error(`Failed to fetch products: ${error.message}`)
        }

        return data as Products[]

    } catch (error) {
        console.error('Error loading products data:', error)
        throw error
    }
}

export const getMenusWithEstablishment = async (establishmentId: string): Promise<MenusWithProducts[]> => {
    console.log('🟡 Loading menus data...') // Solo la primera vez

    try {
        const { data, error, status } = await supabase
            .from('menus')
            .select(`
                name,
                description,
                price,
                menu_product (
                    id_menu_product,
                    products (
                        id_product,
                        name,
                        category
                    )
                )
            `)
            .eq('id_establishment', establishmentId)
            .order('name')

        if (error && status !== 406) {
            console.error('Database error:', error)
            throw new Error(`Failed to fetch menus: ${error.message}`)
        }

        return data as MenusWithProducts[]

    } catch (error) {
        console.error('Error loading menus data:', error)
        throw error
    }
}

export const getOrdersWithEstablishment = async (establishmentId: string): Promise<OrderWithDetails[]> => {

    try {
        const { data, error, status } = await supabase
            .from('orders')
            .select(`
                id_order,
                id_chat,
                id_establishment,
                name,
                price,
                is_pickup,
                address,
                created_at,
                updated_at,
                status,
                chats (
                    phone_number
                ),
                details_order (
                    id_details_order,
                    selected_products,
                    quantity,
                    note,
                    created_at,
                    products (
                        id_product,
                        name,
                        price,
                        category,
                        available
                    ),
                    menus (
                        id_menu,
                        name,
                        price
                    )
                )
            `)
            .eq('id_establishment', establishmentId)
            .order('created_at', { ascending: false })

        if (error && status !== 406) {
            console.error('Database error:', error)
            throw new Error(`Failed to fetch orders: ${error.message}`)
        }

        return data as OrderWithDetails[]

    } catch (error) {
        console.error('Error loading orders data:', error)
        throw error
    }
}
